import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class SalaryTotalMatchesConstraint
  implements ValidatorConstraintInterface
{
  validate(total: number, args: ValidationArguments) {
    const obj = args.object as { rate?: number; units?: number };
    const { rate, units } = obj;

    // If rate and units are both provided, validate that total matches
    if (rate !== undefined && units !== undefined && rate > 0 && units > 0) {
      const expectedTotal = rate * units;
      // Allow small floating point differences
      return Math.abs(total - expectedTotal) < 0.01;
    }

    // If rate or units not provided, just validate total is positive
    return total > 0;
  }

  defaultMessage() {
    return 'Total must equal rate * units when both are provided';
  }
}

export function SalaryTotalMatches(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: SalaryTotalMatchesConstraint,
    });
  };
}
