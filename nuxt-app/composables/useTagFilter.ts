import { computed, reactive, Ref, ref, watch } from '@nuxtjs/composition-api';
import { ADD_TAG_FILTER_EVENT_ID, REMOVE_TAG_FILTER_EVENT_ID } from '../config';
import { trackGoal } from '../helpers';
import { TagItem } from '../types';

interface Tag extends Pick<TagItem, 'id' | 'name'> {
  is_active: boolean;
  occurrence: number;
}

/**
 * Composable that provide the functionality of the tag filter.
 *
 * @param input The data to be filtered.
 *
 * @returns State and methods to use the tag filter.
 */
export function useTagFilter<
  Entities extends { tags: Pick<TagItem, 'id' | 'name'>[] }
>(input: Ref<Entities[] | null | undefined>) {
  /**
   * Get the most frequently occurring tags from the input.
   *
   * @param prevTags The previous tags, if available.
   *
   * @returns The most frequently occurring tags
   */
  const getTags = (prevTags?: Tag[]) => {
    // Get all tags and count occurrences
    const tags = input.value?.reduce((tagList, entity) => {
      // Take a look at every entity tag
      entity.tags.forEach((entityTag) => {
        // Find entity tag in list
        const existingTag = tagList.find(({ id }) => id === entityTag.id);

        // Increase occurrence if tag has already been added
        if (existingTag) {
          existingTag.occurrence += 1;

          // Otherwise add tag to tag list
        } else {
          tagList.push({
            ...entityTag,
            is_active:
              prevTags?.find(({ id }) => id === entityTag.id)?.is_active ||
              false,
            occurrence: 1,
          });
        }
      });

      // Return tag list
      return tagList;
    }, [] as Tag[]);

    // Sort tags by occurrence and cut out first 25 of them
    return (
      tags
        ?.sort((a, b) => (a.occurrence < b.occurrence ? 1 : -1))
        .slice(0, 25) || []
    );
  };

  // Create tags reference
  const tags = ref<Tag[]>(getTags());

  // Track analytic events
  watch(tags, (nextTags, prevTags) => {
    if (prevTags.length === 0 && nextTags.length > 0) {
      trackGoal(ADD_TAG_FILTER_EVENT_ID);
    } else if (prevTags.length > 0 && nextTags.length === 0) {
      trackGoal(REMOVE_TAG_FILTER_EVENT_ID);
    }
  });

  // Update tags when input changes
  watch(input, () => {
    tags.value = getTags(tags.value);
  });

  /**
   * It toggles the active state of a tag.
   *
   * @param index The index of a tag.
   */
  const toggleTag = (_: any, index: number) => {
    tags.value.splice(index, 1, {
      ...tags.value[index],
      is_active: !tags.value[index].is_active,
    });
  };

  // Apply filter and create output
  const output = computed(() => {
    // Get all active tags
    const activeTags = tags.value.filter((tag) => tag.is_active);

    // Filters input if there is an active tag
    if (activeTags.length) {
      return input.value!.filter((entity) =>
        activeTags.some((activeTag) =>
          entity.tags.find((tag) => tag.id === activeTag.id)
        )
      );
    }

    // Otherwise return input
    return input.value || [];
  });

  return reactive({
    tags,
    toggleTag,
    output,
  });
}
