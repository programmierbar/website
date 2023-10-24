function isPublishable(item, fields) {
  const requiredFieldsAreSet = fields.every(
    (field) => {

      const hasValue = Boolean(item[field.field]);
      const isNotRequiredInSchema = !(field.schema && field.schema.required);
      const hasConditions = Boolean(field.meta.conditions);

      let atLeastOneConditionMet = false;
      if (hasConditions) {
        atLeastOneConditionMet = field.meta.conditions.some(
          (condition) =>
            condition.rule.status &&
            condition.rule.status._eq === 'published' &&
            condition.required
        );
      }

      console.log(`Validating field`, {
        name: field.field,
        hasValue: hasValue,
        isNotRequiredInSchema: isNotRequiredInSchema,
        hasConditions: hasConditions,
        atLeastOneConditionMet: atLeastOneConditionMet,
      });

      /*return (!(field.schema && field.schema.required) &&
          !(
            field.meta.conditions &&
            field.meta.conditions.some(
              (condition) =>
                condition.rule.status &&
                condition.rule.status._eq === 'published' &&
                condition.required
            )
          )) ||
        item[field.field]
          );
    }*/

      return hasValue || isNotRequiredInSchema || (hasConditions && atLeastOneConditionMet);

    });

  return requiredFieldsAreSet;
}

export {
  isPublishable
}