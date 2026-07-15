export interface CascadeRelation {
    /** The relation field name on the parent item (e.g. 'speakers', 'picks_of_the_day') */
    relationField: string
    /** For m2m/m2a: the field on the junction record that holds the child item (e.g. 'speaker', 'talk', 'target') */
    childField?: string
    /**
     * For many-to-any (m2a): the junction field holding the related collection
     * name (e.g. 'collection'). Its presence marks the relation as m2a, which is
     * read and unwrapped differently from a plain m2m — see `buildRelationFields`
     * and `extractDraftIds`.
     */
    collectionField?: string
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
        if (relation.collectionField) {
            // Many-to-any: fetch the collection discriminator so we can filter the
            // junction rows to `targetCollection`, and pull the polymorphic target
            // with a wildcard. A wildcard is required because Directus does not
            // resolve a specific subfield (e.g. `.status`) across an m2a relation
            // without collection scoping.
            fields.push(`${relation.relationField}.${relation.collectionField}`)
            fields.push(`${relation.relationField}.${relation.childField}.*`)
        } else if (relation.childField) {
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

    // For m2a, keep only the junction rows pointing at this relation's target
    // collection before unwrapping; other allowed collections are irrelevant here.
    const junctionItems: any[] = relation.collectionField
        ? relatedItems.filter((record: any) => record?.[relation.collectionField!] === relation.targetCollection)
        : relatedItems

    // Extract child items: for m2m/m2a, unwrap from junction records; for o2m, use directly
    const childItems: any[] = relation.childField
        ? junctionItems.map((junctionRecord: any) => junctionRecord[relation.childField!]).filter(Boolean)
        : junctionItems

    // Filter for draft items only and collect their ids
    return childItems
        .filter((item: any) => item && item.status === 'draft')
        .map((item: any) => item.id)
        .filter(Boolean)
}
