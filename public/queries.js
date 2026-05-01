// Auto-fill phone from URL params
const params = new URLSearchParams(window.location.search);
const phoneParam = params.get('phone');
if (phoneParam) {
    document.getElementById('phone').value = phoneParam;
}

document.getElementById('queryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('submitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Submitting...';

    const data = {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        room: document.getElementById('room').value.trim(),
        category: document.getElementById('category').value,
        description: document.getElementById('description').value.trim()
    };

    // Validation
    if (!data.name || !data.phone || !data.description) {
        showError('Please fill in all required fields');
        btn.disabled = false;
        btn.textContent = originalText;
        return;
    }

    if (data.phone.length < 10) {
        showError('Please enter a valid phone number');
        btn.disabled = false;
        btn.textContent = originalText;
        return;
    }

    try {
        console.log('Submitting query:', data);
        const res = await fetch('/api/submit-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        console.log('Response:', result);

        if (res.ok) {
            document.getElementById('queryForm').style.display = 'none';
            document.getElementById('successMsg').style.display = 'block';
        } else {
            throw new Error(result.error || 'Failed to submit query');
        }
    } catch (err) {
        console.error('Submit error:', err);
        showError(err.message || 'Failed to submit. Please try again.');
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

function showError(message) {
    const toast = document.getElementById('errorToast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 4000);
}

function resetForm() {
    document.getElementById('queryForm').reset();
    if (phoneParam) document.getElementById('phone').value = phoneParam;
    document.getElementById('queryForm').style.display = 'block';
    document.getElementById('successMsg').style.display = 'none';
}

// Make resetForm available globally
window.resetForm = resetForm;
