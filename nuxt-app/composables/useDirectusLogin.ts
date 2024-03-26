import { authentication, createDirectus, readProviders, rest } from '@directus/sdk'
import { DIRECTUS_CMS_URL, WEBSITE_URL } from '~/config'
import type { LoginProvider } from '~/types'
import type { Collections } from './../services'

const storage = new (class {
    get() {
        console.debug('Fetching data from storage')

        const directusData = this.$auth.$storage.getUniversal('directus-data')
        if (directusData) {
            return JSON.parse(directusData)
        }

        return null
    }
    set(data) {
        console.debug('Setting data in storage')

        this.$auth.$storage.setUniversal('directus-data', JSON.stringify(data))
    }
})()

//const authenticationConfig = authentication('cookie', { credentials: 'include', storage })
const authenticationConfig = authentication('cookie', { credentials: 'include' })

const directus = createDirectus<Collections>(DIRECTUS_CMS_URL).with(authenticationConfig).with(rest())

export function useDirectusLogin() {
    async function getProviders() {
        const directusProviders = await directus.request(readProviders())

        console.log('DirectusProviders')
        console.log(directusProviders)

        const providers = directusProviders.map((directusProvider): LoginProvider => {
            return {
                name: directusProvider.name,
                url: `${DIRECTUS_CMS_URL.replace(/\/$/, '')}/auth/login/${directusProvider.name}?redirect=${WEBSITE_URL.replace(/\/$/, '')}`,
            }
        })

        console.log('Providers')
        console.log(providers)

        return providers
    }

    return {
        getProviders,
    }
}
