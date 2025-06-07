const { body, validationResult } = require('express-validator');

const subscriptionValidationRules = [
  body('endpoint').isURL().notEmpty(),
  body('keys.auth').isString().notEmpty(),
  body('keys.p256dh').isString().notEmpty()
];

const notificationValidationRules = [
  body('subscription').isArray().notEmpty(),
  body('subscription.*.endpoint').isString().notEmpty(),
  body('subscription.*.keys.auth').isString().notEmpty(),
  body('subscription.*.keys.p256dh').isString().notEmpty(),
  body('payload').isArray().notEmpty(),
  body('payload.*.title').isString().notEmpty(),
  body('payload.*.body').isString().notEmpty()
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = {
  subscriptionValidationRules,
  notificationValidationRules,
  validate
};