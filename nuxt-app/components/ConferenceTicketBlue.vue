<template>
    <svg viewBox="0 0 465 319" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g filter="url(#filter0_ii_2727_4020)">
            <path
                d="M406.444 27.6023C438.398 29.8519 462.476 57.5985 460.227 89.5518L457.844 123.388C427.949 121.283 402.008 143.812 399.903 173.708C397.815 203.37 419.977 229.139 449.524 231.595L450.223 231.649L448.15 261.097C445.9 293.05 418.172 317.141 386.219 314.891L58.1977 291.798C26.2443 289.549 2.16514 261.813 4.41471 229.859L6.48799 200.41C36.3833 202.514 62.3247 179.985 64.4295 150.09C66.5178 120.428 44.3557 94.6581 14.8089 92.2016L14.1097 92.1485L16.4925 58.3035C18.7422 26.3503 46.4699 2.25968 78.4232 4.50923L406.444 27.6023Z"
                fill="url(#prepended_paint0_linear_2727_4020)"
            />
        </g>
        <text
            transform="translate(136.416 33.9502) rotate(4.02705)"
            fill="white"
            xml:space="preserve"
            style="white-space: pre"
            font-family="Museo Sans"
            font-size="32"
            font-weight="bold"
            letter-spacing="0em"
        >
            <tspan x="0.4375" y="31.312">{{ ticket.title }}</tspan>
        </text>
        <text
            transform="translate(72.4727 205.891) rotate(4.02705)"
            fill="white"
            xml:space="preserve"
            style="white-space: pre"
            font-family="Museo Sans"
            font-size="24"
            font-weight="bold"
            letter-spacing="-0.3em"
        >
            <tspan x="89.8578" y="56.484"></tspan>
        </text>
        <text
            transform="translate(72.4727 205.891) rotate(4.02705)"
            fill="white"
            xml:space="preserve"
            style="white-space: pre"
            font-family="Museo Sans"
            font-size="24"
            font-weight="bold"
            letter-spacing="0em"
        >
            <tspan x="0.40625" y="24.484">{{ ticket.subtitle }}</tspan>
        </text>
        <text
            transform="translate(68.9492 93.3589) rotate(4.02705)"
            fill="white"
            xml:space="preserve"
            style="white-space: pre"
            font-family="Museo Sans"
            font-size="112"
            font-weight="bold"
            letter-spacing="0em"
        >
            <tspan x="25.2426" y="86.08">{{ ticket.price }}</tspan>
        </text>
        <text
            transform="translate(68.9492 93.3589) rotate(4.02705)"
            fill="white"
            xml:space="preserve"
            style="white-space: pre"
            font-family="Museo Sans"
            font-size="112"
            font-weight="bold"
            letter-spacing="-0.1em"
        >
            <tspan x="228.79" y="86.08"></tspan>
        </text>
        <defs>
            <filter
                id="filter0_ii_2727_4020"
                x="-1.73047"
                y="-3.63623"
                width="468.104"
                height="326.673"
                filterUnits="userSpaceOnUse"
                color-interpolation-filters="sRGB"
            >
                <feFlood flood-opacity="0" result="BackgroundImageFix" />
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                />
                <feOffset dx="-6" dy="-8" />
                <feGaussianBlur stdDeviation="5" />
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0.473964 0 0 0 0 0.751188 0 0 0 0.7 0" />
                <feBlend mode="normal" in2="shape" result="effect1_innerShadow_2727_4020" />
                <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                />
                <feOffset dx="6" dy="8" />
                <feGaussianBlur stdDeviation="5" />
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.25 0" />
                <feBlend mode="normal" in2="effect1_innerShadow_2727_4020" result="effect2_innerShadow_2727_4020" />
            </filter>
            <linearGradient
                id="prepended_paint0_linear_2727_4020"
                x1="185.98"
                y1="43.7093"
                x2="319.614"
                y2="318.964"
                gradientUnits="userSpaceOnUse"
            >
                <stop stop-color="#2CB1FF" />
                <stop offset="1" stop-color="#00A1FF" />
            </linearGradient>
        </defs>
    </svg>
</template>

<script setup lang="ts">
type Ticket = {
    price: string
    title: string
    subtitle: string
    style: string
}

defineProps<{
    ticket: Ticket
}>()
</script>
