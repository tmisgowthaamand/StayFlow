import Joi from 'joi';

export const phoneSchema = Joi.string().pattern(/^\d{10,15}$/).required();
export const nameSchema = Joi.string().min(1).max(100).pattern(/^[a-zA-Z\s.'-]+$/).required();

export const registerSchema = Joi.object({
    name: nameSchema,
    phone: phoneSchema,
    room: Joi.string().max(20).required(),
    sharing: Joi.string().valid('single', 'double', 'triple', 'quad', '1-share', '2-share', '3-share', '4-share').optional(),
    sharingType: Joi.string().max(50).optional(),
    advance: Joi.number().min(0).max(100000).optional(),
    rent: Joi.number().min(0).max(100000).optional(),
    location: Joi.string().max(100).optional(),
    emergencyContact: Joi.string().pattern(/^\d{10,15}$/).optional(),
    idProof: Joi.string().optional(),
});

export const querySchema = Joi.object({
    name: nameSchema,
    phone: phoneSchema,
    room: Joi.string().max(20).required(),
    category: Joi.string().valid('maintenance', 'electrical', 'plumbing', 'cleaning', 'food', 'noise', 'other').required(),
    description: Joi.string().min(5).max(1000).required(),
});

export const vacateSchema = Joi.object({
    phone: phoneSchema,
    reason: Joi.string().min(5).max(500).required(),
    vacateDate: Joi.date().iso().min('now').required(),
    feedback: Joi.string().max(1000).optional(),
});

export const paymentSchema = Joi.object({
    phone: phoneSchema,
    name: nameSchema,
    amount: Joi.string().required(), // Can be string like "5000" or "5000.00"
    mode: Joi.string().valid('cash', 'upi', 'bank', 'online', 'CASH', 'UPI', 'BANK', 'ONLINE', 'Cash', 'Upi').optional(),
});

export function validate(schema) {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details.map(d => d.message)
            });
        }
        next();
    };
}
