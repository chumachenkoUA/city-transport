import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsNotFutureDateConstraint implements ValidatorConstraintInterface {
  validate(date: Date | string | undefined) {
    if (!date) return true;
    const dateValue = date instanceof Date ? date : new Date(date);
    return dateValue <= new Date();
  }

  defaultMessage() {
    return 'Date cannot be in the future';
  }
}

export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsNotFutureDateConstraint,
    });
  };
}
