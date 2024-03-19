/**
 * It stops the execution of the code for a certain time.
 *
 * @param time The time to wait.
 *
 * @returns A promise object.
 */
export function sleep(time: number) {
    return new Promise((resolve) => setTimeout(resolve, time))
}
