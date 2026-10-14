// mjml 5 ships no type declarations; this covers the slice the renderer uses.
declare module 'mjml' {
    interface MjmlError {
        line: number
        message: string
        tagName: string
        formattedMessage: string
    }

    interface MjmlOptions {
        validationLevel?: 'strict' | 'soft' | 'skip'
        keepComments?: boolean
        ignoreIncludes?: boolean
        beautify?: boolean
        minify?: boolean
    }

    interface MjmlResult {
        html: string
        errors: MjmlError[]
    }

    export default function mjml2html(mjml: string, options?: MjmlOptions): Promise<MjmlResult>
}
