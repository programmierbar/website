/*
 * THIS IS AN OLDER VERSION OF THE isPublishable helper
 * It does not respect the (new?) rule data model where all rules are combined by an '_and' rule
 * We will keep this around in case our live data has not been migrated to the new model yet.
 */

function isPublishable(item, fields) {
    const requiredFieldsAreSet = fields.every((field) => {
        const hasValue = Boolean(item[field.field])
        const isRequiredInSchema = field.schema && field.schema.required
        const hasConditions = Boolean(field.meta.conditions)

        let isRequiredOnPublished = false
        if (hasConditions) {
            isRequiredOnPublished = field.meta.conditions.some(
                (condition) => condition.rule.status && condition.rule.status._eq === 'published' && condition.required
            )
        }

        const isOptional = !isRequiredInSchema && !isRequiredOnPublished

        return hasValue || isOptional
    })

    return requiredFieldsAreSet
}

module.exports = {
    isPublishable,
}
