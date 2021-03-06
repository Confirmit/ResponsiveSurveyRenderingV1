import Event from 'event.js'
import QuestionBase from './question-base.js';
import QuestionValidationResult from './../validation/question-validation-result.js';
import AnswerValidationResult from './../validation/answer-validation-result.js';
import ValidationError from './../validation/validation-error.js';

/**
 * @desc A base class for Question
 * @extends {QuestionBase}
 */
export default class Question extends QuestionBase {
    /**
     * Create instance.
     * @param {object} model - The instance of the model.
     */
    constructor(model) {
        super(model);

        this._readOnly = model.readOnly;
        this._required = model.required;
        this._validationRules = model.validationRules || [];
        this._triggeredQuestions = model.triggeredQuestions || [];

        this._allowValidateOnChange = true;
        this._validateOnChange = false;

        // Events
        this._changeEvent = new Event("question:change");
        this._validationEvent = new Event("question:validation");
        this._validationCompleteEvent = new Event("question:validation-complete");
    }

    /**
     * Is it read-only question.
     * @type {boolean}
     * @readonly
     */
    get readOnly() {
        return this._readOnly;
    }

    /**
     * Is question required.
     * @type {boolean}
     * @readonly
     */
    get required() {
        return this._required;
    }

    /**
     * Get allow auto re-validation on change value.
     * @type {boolean}
     */
    get allowValidateOnChange() {
        return this._allowValidateOnChange;
    }

    /**
     * Set allow auto re-validation on change value.
     * @param {boolean} value
     */
    set allowValidateOnChange(value) {
        this._allowValidateOnChange = value;
    }

    /**
     * Fired on answer changes.
     * The handler callback function can take parameters. When the handler is called, object will be passed as only parameter.
     * Object has two properties: model - it is question model. changes - object with changes difference.
     * @event changeEvent
     * @type {Event}
     * @memberOf Question
     */
    get changeEvent() {
        return this._changeEvent;
    }

    /**
     * Fired on question validation. Use to implement custom validation logic.
     * The handler callback function can take parameters. When the handler is called, instance of {@link QuestionValidationResult} will be passed as only parameter.
     * @event validationEvent
     * @type {Event}
     * @memberOf Question
     */
    get validationEvent() {
        return this._validationEvent;
    }

    /**
     * Fired on question validation complete. Use to implement custom error handling.
     * The handler callback function can take parameters. When the handler is called, instance of {@link QuestionValidationResult} will be passed as only parameter.
     * @event validationEvent
     * @type {Event}
     * @memberOf Question
     */
    get validationCompleteEvent() {
        return this._validationCompleteEvent;
    }

    /**
     * @inheritDoc
     */
    get triggeredQuestions() {
        return this._triggeredQuestions;
    }

    /**
     * Perform question validation.
     * @param {boolean} [raiseValidationCompleteEvent=true] - Raise validationComplete event if true.
     * @param {function} [validationRuleFilter=null] - Custom filter function to apply specific validation rules only.
     * @return {QuestionValidationResult} - Question validation result.
     */
    validate(raiseValidationCompleteEvent = true, validationRuleFilter = null) {
        const validationResult = this._validate(validationRuleFilter);

        this._onValidation(validationResult);

        if (raiseValidationCompleteEvent) {
            this._onValidationComplete(validationResult);
        }

        return validationResult;
    }


    // TODO: could be good to keep fullness of answers picture
    _validate(validationRuleFilter = null) {
        let validationRules = this._validationRules;
        if (validationRuleFilter !== null) {
            validationRules = this._validationRules.filter(validationRuleFilter);
        }

        const questionValidationResult = new QuestionValidationResult(this._id);
        validationRules.forEach(rule => {
            const ruleValidationResult = this._validateRule(rule.type);
            if (ruleValidationResult.isValid) {
                return;
            }

            const validationError = new ValidationError(rule.type, rule.message, ruleValidationResult.data);

            if (ruleValidationResult.answers.length === 0) {
                questionValidationResult.errors.push(validationError);
            } else {
                ruleValidationResult.answers.forEach(answerCode => {
                    let answerValidationResult = questionValidationResult.answerValidationResults.find(answerResult => answerResult.answerCode === answerCode);
                    if (answerValidationResult === undefined) {
                        answerValidationResult = new AnswerValidationResult(answerCode);
                        questionValidationResult.answerValidationResults.push(answerValidationResult);
                    }

                    answerValidationResult.errors.push(validationError)
                });
            }
        });
        return questionValidationResult;
    }

    // eslint-disable-next-line no-unused-vars
    _validateRule(validationType) {
    }

    _diffPrimitives(oldValue, newValue) {
        return oldValue !== newValue;
    }

    _diffArrays(oldValue, newValue) {
        const added = newValue.filter(newVal => !oldValue.includes(newVal));
        const removed = oldValue.filter(oldVal => !newValue.includes(oldVal));
        return [...added, ...removed];
    }

    _diffObjects(oldValue, newValue) {
        const oldKeys = Object.keys(oldValue);
        const newKeys = Object.keys(newValue);
        const added = newKeys.filter(newKey => !oldKeys.includes(newKey));
        const removed = oldKeys.filter(oldKey => !newKeys.includes(oldKey));
        const modified = oldKeys.filter(oldKey => newKeys.includes(oldKey)).filter(key => oldValue[key] !== newValue[key]);
        return [...added, ...removed, ...modified];
    }

    /**
     * Set value common algorithm.
     * @protected
     * @param {string} valuePropertyName - property name where changing value is store in question object.
     * @param {function(): boolean} setValue - set value delegate, return true if value is changed
     * @param {function(*, *): object} diffValues - diff values delegate, return object with info about changes.
     */
    _setValueInternal(valuePropertyName, setValue, diffValues = this._diffObjects) {
        if (this.readOnly) {
            return;
        }

        const oldValue = this[valuePropertyName];

        const changed = setValue();
        if (changed) {
            const diff = diffValues(oldValue, this[valuePropertyName]);
            this._onChange({[valuePropertyName]: diff});
        }
    }

    // Handlers
    _onChange(changes) {
        this._changeEvent.trigger({model: this, changes});
        if (this._allowValidateOnChange && this._validateOnChange) {
            this.validate();
        }
    }

    _onValidation(validationResult) {
        this._validationEvent.trigger(validationResult);
    }

    _onValidationComplete(validationResult) {
        this._validationCompleteEvent.trigger(validationResult);

        if (validationResult.isValid === false) {
            this._validateOnChange = true; // if there were errors, force re-validate on change
        }
    }
}
