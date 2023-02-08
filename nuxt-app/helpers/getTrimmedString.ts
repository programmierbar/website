/**
 * A helper function that trims a string to a maximal length.
 *
 * @param string The string to be trimmed.
 * @param maxLength The maximal length.
 *
 * @returns A trimmed string.
 */
export function getTrimmedString(string: string, maxLength: number) {
  if (maxLength < string.length) {
    const trimmedString = string.slice(0, maxLength).trim();
    return (
      trimmedString +
      (trimmedString.charAt(trimmedString.length - 1) === '.' ? '..' : '...')
    );
  }
  return string;
}
