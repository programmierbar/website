interface Field {
    field: string
    schema: {
        required: boolean
    }
    meta: {
        conditions: {
            required: boolean
            rule: Record<
                string,
                {
                    status: {
                        _eq: string
                    },
                    type: {
                        _in: Array<string>
                    }
                }[]
            >
        }[]
    }
}

// eslint-disable-next-line no-unused-vars
type LoggerFunction = (message: string) => void

const isRuleForPublished = function(rule: any): boolean {
    return rule.status && rule.status._eq && rule.status._eq === 'published';
}
const isRuleApplicable = function(rule: any, item: Record<string, any>): boolean {

    if (rule.type && rule.type._in && item.type && rule.type._in.includes(item.type)) {
        return true;
    }

    return false;
}


export function isPublishable(item: Record<string, any>, fields: Field[], logger?: LoggerFunction) {
    const requiredFieldsAreSet = fields.every((field) => {
        (() => logger?.('Controlling field ' + field.field))()

        const hasValue = Boolean(item[field.field])
        const isRequiredInSchema = field.schema && field.schema.required
        const hasConditions = Boolean(field.meta.conditions)

        let isRequiredOnPublished = false
        if (hasConditions) {
            ;(() => logger?.('Has conditions'))()
            ;(() => logger?.(JSON.stringify(field.meta.conditions)))()

            isRequiredOnPublished = field.meta.conditions.some((condition) => {
                ;(() => logger?.('condition ' + JSON.stringify(condition)))()
                return (
                    condition.required &&
                    condition.rule &&
                    (
                        // Either the rule(s) are a single rule only
                        isRuleForPublished(condition.rule) ||
                        (
                            // or they are combined with an AND
                            condition.rule._and &&
                            (
                                // but that AND might only contain a single rule
                                // then only the one needs to apply
                                (condition.rule._and.length === 1 && condition.rule._and.some(
                                    (rule) => isRuleForPublished(rule)
                                )) ||
                                (
                                    // or it might contain multiple rules, then each needs to apply
                                    condition.rule._and.some(
                                        (rule) => isRuleForPublished(rule)
                                    ) &&
                                    condition.rule._and.some(
                                        (rule) => isRuleApplicable(rule, item)
                                    )
                                )
                            )
                        )
                    )
                )
            });
            (() => logger?.('is required on published ' + isRequiredOnPublished))()
        }
        const isOptional = !isRequiredInSchema && !isRequiredOnPublished;

        (() => logger?.('Is set: ' + (hasValue || isOptional)))()

        return hasValue || isOptional
    })

    return requiredFieldsAreSet
}
