interface Field {
    field: string;
    schema: {
        required: boolean;
    };
    meta: {
        conditions: {
            required: boolean,
            rule: Record<string, {
                status: {
                    _eq: string
                }
            }[]>
        }[]
    }
}

type LoggerFunction = (message: string) => void;

export function isPublishable(item: Record<string, any>, fields: Field[], logger?: LoggerFunction) {
    const requiredFieldsAreSet = fields.every((field) => {

        (() => logger?.('Controlling field ' + field.field))();

        const hasValue = Boolean(item[field.field])
        const isRequiredInSchema = field.schema && field.schema.required
        const hasConditions = Boolean(field.meta.conditions)

        let isRequiredOnPublished = false
        if (hasConditions) {
            (() => logger?.('Has conditions'))();
            (() => logger?.(JSON.stringify(field.meta.conditions)))();

            isRequiredOnPublished = field.meta.conditions.some(
                (condition) => {
                    (() => logger?.('condition ' + JSON.stringify(condition)))();
                    return condition.required && condition.rule && condition.rule._and && condition.rule._and.some((rule) => (rule.status && rule.status._eq && rule.status._eq === 'published'))
                }
            );

            (() => logger?.('is required on published ' + isRequiredOnPublished))();
        }
        const isOptional = (!isRequiredInSchema && !isRequiredOnPublished);

        (() => logger?.('Is set: ' + (hasValue || isOptional)))();

        return hasValue || isOptional
    })

    return requiredFieldsAreSet
}
