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

      return hasValue || isOptional;

    });

  return requiredFieldsAreSet;
}

module.exports = {
  isPublishable
}