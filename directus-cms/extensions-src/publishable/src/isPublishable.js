function isPublishable(item, fields) {
  const requiredFieldsAreSet = fields.every(
    (field) => {

      const hasValue = Boolean(item[field.field]);
      const isRequiredInSchema = (field.schema && field.schema.required);

      const hasConditions = Boolean(field.meta.conditions);

      let isRequiredOnPublished = false;

      if (hasConditions) {
        isRequiredOnPublished = field.meta.conditions.some(
          (condition) =>
            condition.rule.status &&
            condition.rule.status._eq === 'published' &&
            condition.required
        );
      }

      const isOptional = !isRequiredInSchema && !isRequiredOnPublished;

      console.log(`Validating field`, {
        name: field.field,
        hasValue: hasValue,
        isRequiredInSchema: isRequiredInSchema,
        hasConditions: hasConditions,
        isRequiredOnPublished: isRequiredOnPublished,
        isOptional: isOptional,
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

      return hasValue || isOptional;

    });

  return requiredFieldsAreSet;
}

export {
  isPublishable
}