import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsTimeAfterConstraint implements ValidatorConstraintInterface {
  validate(endTime: string, args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    const startTime = (args.object as Record<string, unknown>)[
      relatedPropertyName
    ] as string;

    if (!startTime || !endTime) return true;

    const parseTime = (time: string): number => {
      const parts = time.split(':').map(Number);
      return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    };

    return parseTime(endTime) > parseTime(startTime);
  }

  defaultMessage(args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    return `${args.property} must be after ${relatedPropertyName}`;
  }
}

export function IsTimeAfter(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: IsTimeAfterConstraint,
    });
  };
}
