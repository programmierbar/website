/* eslint-disable @typescript-eslint/ban-types */

/**
 * Helper function that determines whether an
 * object has a key with the specified name.
 *
 * @param key The key you are looking for.
 * @param object The object to be scanned.
 */
export function isKeyInObject<T extends Object, K extends PropertyKey>(
  key: K,
  object: T
): object is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key);
}
