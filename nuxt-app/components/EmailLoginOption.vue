<script setup lang="ts">
import MailIcon from '~/assets/logos/mail.svg'
import { ref } from 'vue'

const emit = defineEmits<{ (event: 'registerUser', user: { email: string; password: string }): void }>()

const clicked = ref(false)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const showEmailWarning = computed(() => email.value.length > 5 && !emailRegex.test(email.value))

const showPasswordWarning = computed(
    () => password.value !== '' && confirmPassword.value !== '' && password.value !== confirmPassword.value
)

function getTranslateStyle(factor: number = 1) {
    return `--translateY: -${20 * factor}px`
}

function handleRegisterClick() {
    if (showEmailWarning.value || showPasswordWarning.value) {
        return
    }

    emit('registerUser', { email: email.value, password: password.value })
}
</script>

<template>
    <div class="email-option-button flex flex-col items-center justify-center gap-y-4">
        <div
            class="btn btn-primary relative flex w-full items-center justify-center gap-x-4 rounded-full border-2 px-7 py-3.5 text-base font-light leading-8 text-white md:text-2xl"
            :class="{ 'animated-border': clicked }"
            @click="clicked = true"
        >
            <Transition name="fade">
                <MailIcon v-if="!clicked" class="absolute left-6 w-8 md:left-9" />
            </Transition>

            <div class="relative flex-1 text-center">
                <span>Mit Email anmelden</span>
                <div class="line-container"></div>
            </div>
        </div>
        <TransitionGroup
            name="input-fade"
            tag="div"
            class="flex w-10/12 flex-col items-center justify-center gap-y-4 rounded-lg"
        >
            <input
                v-if="clicked"
                key="email"
                v-model="email"
                class="input-field"
                type="email"
                placeholder="E-Mail"
                :style="getTranslateStyle"
            />
            <input
                v-if="clicked"
                key="password"
                v-model="password"
                class="input-field"
                type="password"
                placeholder="Passwort"
                :style="getTranslateStyle(4)"
            />
            <input
                v-if="clicked"
                key="confirm-password"
                v-model="confirmPassword"
                class="input-field"
                type="password"
                placeholder="Passwort bestätigen"
                :style="getTranslateStyle(8)"
            />
            <span v-if="showEmailWarning" class="text-pink-600">Bitte geben Sie eine gültige E-Mail-Adresse ein!</span>
            <span v-if="showPasswordWarning" class="text-pink-600">Die Passwörter stimmen nicht überein!</span>
        </TransitionGroup>
        <Transition name="fade">
            <RegisterButton v-if="clicked" class="h-14 w-48" @click="handleRegisterClick">
                <span> Anmelden </span>
            </RegisterButton>
        </Transition>
    </div>
</template>

<style scoped lang="postcss">
.email-option-button {
    --animation-duration: 0.5s;
    --animation-delay: calc(0.5 * var(--animation-duration));
}
.animated-border {
    animation: border-opacity-fade var(--animation-duration) ease-out forwards;
}

.input-field {
    @apply h-12 w-full rounded-lg pl-5 text-white;
    background-color: #3a3d3f;
}

.input-field::placeholder {
    color: white;
    font-style: italic;
}

@keyframes border-opacity-fade {
    0% {
        border-color: rgba(255, 255, 255, 0.7);
    }
    100% {
        border-color: rgba(255, 255, 255, 0);
    }
}

.line-container::before,
.line-container::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 0;
    height: 2px;
    background-color: white;
    transition: width var(--animation-duration) ease-out var(--animation-delay);
}

.line-container::before {
    left: -20px;
    transform: translateY(-50%);
}

.line-container::after {
    right: -20px;
    transform: translateY(-50%);
}

.animated-border .line-container::before,
.animated-border .line-container::after {
    @apply w-16 md:w-20;
}

.fade-leave-active,
.fade-enter-active {
    transition: all var(--animation-duration) ease-out;
}
.fade-leave-to,
.fade-enter-from {
    opacity: 0;
}

.input-fade-enter-active {
    transition: all var(--animation-duration) ease-out;
}
.input-fade-enter-from {
    opacity: 0;
    transform: translateY(var(--translateY));
}
.input-fade-enter-to {
    opacity: 1;
    transform: translateY(0);
}
</style>