const params = new URLSearchParams(window.location.search);
const phoneParam = params.get('phone');

// Immediately hide loading and show form
document.getElementById('loadingState').style.display = 'none';
document.getElementById('vacateForm').style.display = 'block';

// Set minimum date to 30 days from today
const dateInput = document.getElementById('vacateDate');
const minDate = new Date();
minDate.setDate(minDate.getDate() + 30);
dateInput.min = minDate.toISOString().split('T')[0];
dateInput.value = minDate.toISOString().split('T')[0];

// Show/hide other reason field
document.getElementById('reason').addEventListener('change', (e) => {
    document.getElementById('otherReasonGroup').style.display = e.target.value === 'Other' ? 'block' : 'none';
});

// Load tenant info if phone parameter exists
if (phoneParam) {
    (async () => {
        try {
            const res = await fetch(`/api/tenant-info?phone=${encodeURIComponent(phoneParam)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.tenant) {
                    document.getElementById('tenantName').textContent = data.tenant.name || '—';
                    document.getElementById('tenantRoom').textContent = data.tenant.room || '—';
                    document.getElementById('tenantRent').textContent = '₹' + (data.tenant.rent || '0');
                    document.getElementById('tenantAdvance').textContent = '₹' + (data.tenant.advance || '0');
                    document.getElementById('tenantInfo').style.display = 'block';
                }
            }
        } catch (e) {
            console.warn('Could not load tenant info:', e);
        }
    })();
}

document.getElementById('vacateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Submitting...';

    const reasonSelect = document.getElementById('reason');
    let reason = reasonSelect.value;

    if (!reason) {
        alert('Please select a reason for leaving');
        btn.disabled = false;
        btn.textContent = '🚪 Submit Vacate Request';
        return;
    }

    if (reason === 'Other') {
        const other = document.getElementById('otherReason').value.trim();
        if (!other) {
            alert('Please specify your reason');
            btn.disabled = false;
            btn.textContent = '🚪 Submit Vacate Request';
            return;
        }
        reason = other;
    }

    const vacateDateValue = document.getElementById('vacateDate').value;
    if (!vacateDateValue) {
        alert('Please select a vacate date');
        btn.disabled = false;
        btn.textContent = '🚪 Submit Vacate Request';
        return;
    }

    if (!phoneParam) {
        alert('Phone number not found. Please open the form from WhatsApp link.');
        btn.disabled = false;
        btn.textContent = '🚪 Submit Vacate Request';
        return;
    }

    const data = {
        phone: phoneParam,
        reason: reason,
        vacateDate: vacateDateValue + 'T00:00:00Z',
        feedback: document.getElementById('feedback').value.trim() || 'No feedback'
    };

    try {
        const res = await fetch('/api/submit-vacate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (res.ok && result.success) {
            const requestId = result.requestId || 'Submitted';
            const tenantName = document.getElementById('tenantName').textContent || 'Unknown';
            const tenantRoom = document.getElementById('tenantRoom').textContent || '—';
            const today = new Date().toLocaleDateString('en-IN');
            const vacateDateFormatted = new Date(data.vacateDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

            document.getElementById('vacateForm').style.display = 'none';
            document.getElementById('tenantInfo').style.display = 'none';
            document.getElementById('successMsg').style.display = 'block';

            // Populate success screen
            document.getElementById('requestId').textContent = '🆔 Request ID: ' + requestId;
            document.getElementById('successReqId').textContent = requestId;
            document.getElementById('successName').textContent = tenantName;
            document.getElementById('successRoom').textContent = tenantRoom;
            document.getElementById('successReason').textContent = reason;
            document.getElementById('successRequested').textContent = today;
            document.getElementById('successVacateBy').textContent = vacateDateFormatted;

            window.scrollTo(0, 0);
        } else {
            throw new Error(result.error || 'Failed to submit');
        }
    } catch (err) {
        const toast = document.getElementById('errorToast');
        toast.textContent = '❌ ' + (err.message || 'Something went wrong. Please try again.');
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 5000);
    }

    btn.disabled = false;
    btn.textContent = '🚪 Submit Vacate Request';
});
