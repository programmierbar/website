<template>
  <svg viewBox="0 0 496 375" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g filter="url(#filter0_ii_2727_4012)">
      <path
        d="M378.47 12.6758C409.803 6.01906 440.604 26.0424 447.261 57.3755L454.31 90.5549C424.995 96.7829 406.279 125.597 412.507 154.912C418.686 183.998 447.1 202.649 476.177 196.856L476.864 196.715L482.999 225.591C489.655 256.924 469.653 287.731 438.32 294.388L116.666 362.724C85.3329 369.381 54.5341 349.368 47.8773 318.035L41.7422 289.157C71.0572 282.929 89.773 254.115 83.5452 224.8C77.3658 195.714 48.9521 177.062 19.875 182.855L19.1883 182.997L12.1375 149.809C5.48094 118.476 25.4828 87.6685 56.8158 81.0118L378.47 12.6758Z"
        fill="#CFFF00"/>
    </g>
    <text transform="translate(110.898 103.382) rotate(-11.9943)" fill="black" xml:space="preserve"
          style="white-space: pre" font-family="Museo Sans" font-size="32" font-weight="bold" letter-spacing="0em"><tspan x="0.03125" y="31.312">{{ ticket.title }}</tspan></text>
    <text transform="translate(114 274.343) rotate(-11.9943)" fill="black" xml:space="preserve" style="white-space: pre"
          font-family="Azeret Mono" font-size="24" font-weight="bold" letter-spacing="-0.3em"><tspan x="81.8578" y="56.484"> </tspan></text>
    <text id="" transform="translate(114 274.343) rotate(-11.9943)" fill="black" xml:space="preserve"
          style="white-space: pre" font-family="Museo Sans" font-size="24" font-weight="bold" letter-spacing="0em">
    <tspan id="textPre" x="0.210938" y="24.484">{{ ticket.subtitle }}</tspan>
  </text>
    <text transform="translate(72.2324 177.025) rotate(-11.9943)" fill="black" xml:space="preserve"
          style="white-space: pre" font-family="Museo Sans" font-size="112" font-weight="bold" letter-spacing="0em"><tspan x="60.5707" y="86.08" id="textPrice" >{{ ticket.price }}</tspan>
    </text>
    <text transform="translate(72.2324 177.025) rotate(-11.9943)" fill="black" xml:space="preserve"
          style="white-space: pre" font-family="Museo Sans" font-size="112" font-weight="bold" letter-spacing="-0.1em"><tspan x="193.461" y="86.08"> </tspan></text>
    <defs>
      <filter id="filter0_ii_2727_4012" x="4.85938" y="3.39844" width="485.418" height="370.604"
              filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                       result="hardAlpha"/>
        <feOffset dx="-6" dy="-8"/>
        <feGaussianBlur stdDeviation="5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.314602 0 0 0 0 0.388265 0 0 0 0 0 0 0 0 0.7 0"/>
        <feBlend mode="normal" in2="shape" result="effect1_innerShadow_2727_4012"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                       result="hardAlpha"/>
        <feOffset dx="6" dy="10"/>
        <feGaussianBlur stdDeviation="5"/>
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
        <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.25 0"/>
        <feBlend mode="normal" in2="effect1_innerShadow_2727_4012" result="effect2_innerShadow_2727_4012"/>
      </filter>
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
