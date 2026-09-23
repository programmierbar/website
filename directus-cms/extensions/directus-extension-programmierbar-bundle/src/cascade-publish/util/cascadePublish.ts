export interface CascadeRelation {
    /** The relation field name on the parent item (e.g. 'speakers', 'picks_of_the_day') */
    relationField: string
    /** For m2m: the field on the junction record that holds the child item (e.g. 'speaker', 'talk') */
    childField?: string
    /** The Directus collection of the related items */
    targetCollection: string
}

/**
 * Whether a publish action payload should trigger cascading. Cascading only
 * happens once the parent item reaches the 'published' status.
 *
 * @param payload The payload of the create/update action.
 */
export function isPublishPayload(payload: Record<string, any> | undefined): boolean {
    return payload?.status === 'published'
}

/**
 * Extract the affected parent keys from a Directus action metadata object.
 * Updates expose `keys` (an array) while single creates expose `key`.
 *
 * @param metadata The action metadata.
 */
export function extractParentKeys(metadata: Record<string, any>): string[] {
    return metadata.keys || (metadata.key ? [metadata.key] : [])
}

/**
 * Build the nested fields list needed to read a parent item together with the
 * ids and statuses of all its related items.
 *
 * @param relations The relations to cascade into.
 */
export function buildRelationFields(relations: CascadeRelation[]): string[] {
    const fields: string[] = []

    for (const relation of relations) {
        if (relation.childField) {
            fields.push(`${relation.relationField}.${relation.childField}.id`)
            fields.push(`${relation.relationField}.${relation.childField}.status`)
        } else {
            fields.push(`${relation.relationField}.id`)
            fields.push(`${relation.relationField}.status`)
        }
    }

    return fields
}

/**
 * Extract the ids of draft child items for a relation, unwrapping m2m junction
 * records when a `childField` is configured and using o2m items directly
 * otherwise.
 *
 * @param parentItem The parent item read with nested relation data.
 * @param relation The relation to extract draft child ids from.
 */
export function extractDraftIds(parentItem: Record<string, any>, relation: CascadeRelation): string[] {
    const relatedItems = parentItem[relation.relationField]

    if (!Array.isArray(relatedItems) || relatedItems.length === 0) {
        return []
    }

    // Extract child items: for m2m, unwrap from junction records; for o2m, use directly
    const childItems: any[] = relation.childField
        ? relatedItems.map((junctionRecord: any) => junctionRecord[relation.childField!]).filter(Boolean)
        : relatedItems

    // Filter for draft items only and collect their ids
    return childItems
        .filter((item: any) => item && item.status === 'draft')
        .map((item: any) => item.id)
        .filter(Boolean)
}
