/**
 * Simple Handlebars-like template renderer.
 *
 * Supports: {{variable}} and {{#if variable}}...{{/if}}
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
    let result = template

    // Handle simple variables {{variable}}
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
        result = result.replace(regex, value || '')
    }

    // Handle conditional blocks {{#if variable}}...{{/if}}
    const ifBlockRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g
    result = result.replace(ifBlockRegex, (_, varName, content) => {
        return variables[varName] ? content : ''
    })

    return result
}
