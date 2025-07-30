<template>
  <svg viewBox="0 0 473 333" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g filter="url(#filter0_ii_2727_4028)">
      <path d="M384.918 6.62689C416.779 3.32251 445.289 26.4922 448.593 58.3536L452.093 92.0926C422.283 95.1842 400.624 121.856 403.715 151.666C406.783 181.242 433.064 202.795 462.59 200.11L463.288 200.043L466.334 229.406C469.638 261.267 446.489 289.786 414.627 293.09L87.5488 327.012C55.6872 330.317 27.1786 307.158 23.8741 275.296L20.8286 245.931C50.6381 242.84 72.2973 216.168 69.2059 186.358C66.1384 156.782 39.8575 135.228 10.3307 137.913L9.63283 137.981L6.13277 104.233C2.82859 72.372 25.9775 43.8534 57.839 40.549L384.918 6.62689Z" fill="url(#paint0_linear_2727_4028)"/>
    </g>
    <text transform="translate(151.83 65.4861) rotate(-5.92111)" fill="white" xml:space="preserve" style="white-space: pre" font-family="Museo Sans" font-size="32" font-weight="bold" letter-spacing="0em"><tspan x="0.15625" y="31.312">{{ ticket.title }}</tspan></text>
    <text transform="translate(88 252.291) rotate(-6.72777)" fill="white" xml:space="preserve" style="white-space: pre" font-family="Museo Sans" font-size="24" font-weight="bold" letter-spacing="0em"><tspan x="0.40625" y="24.484">{{ ticket.subtitle }}</tspan></text>
    <text transform="translate(64.8066 138.855) rotate(-5.92111)" fill="white" xml:space="preserve" style="white-space: pre" font-family="Museo Sans" font-size="112" font-weight="bold" letter-spacing="0em"><tspan x="26.6098" y="86.08">{{ ticket.price }}</tspan></text>
    <text transform="translate(64.8066 138.855) rotate(-5.92111)" fill="white" xml:space="preserve" style="white-space: pre" font-family="Museo Sans" font-size="112" font-weight="bold" letter-spacing="-0.1em"><tspan x="227.422" y="86.08"> </tspan></text>
    <defs>
      <filter id="filter0_ii_2727_4028" x="-0.181641" y="-1.68701" width="472.83" height="337.013" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="6" dy="8"/>
        <feGaussianBlur stdDeviation="4"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.25 0"/>
        <feBlend mode="normal" in2="shape" result="effect1_innerShadow_2727_4028"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dx="-6" dy="-8"/>
        <feGaussianBlur stdDeviation="5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.456104 0 0 0 0 0 0 0 0 0 0.20592 0 0 0 0.7 0"/>
        <feBlend mode="normal" in2="effect1_innerShadow_2727_4028" result="effect2_innerShadow_2727_4028"/>
      </filter>
      <linearGradient id="paint0_linear_2727_4028" x1="129.564" y1="48.56" x2="412.563" y2="300.478" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FA338D"/>
        <stop offset="1" stop-color="#FF0074"/>
      </linearGradient>
    </defs>
  </svg>

</template>

<script setup lang="ts">
type Ticket = {
  price: string,
  title: string,
  subtitle: string,
  style: string,
}

defineProps<{
  ticket: Ticket,
}>();
</script>
