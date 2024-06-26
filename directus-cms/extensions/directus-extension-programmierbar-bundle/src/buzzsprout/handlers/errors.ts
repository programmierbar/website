import {createError} from '@directus/errors'

export function buzzsproutError(message: string){
  return createError('BUZZSPROUT_ERROR', message);
}