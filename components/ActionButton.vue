<template>
  <button
    :type="type"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :class="[
      'px-6 py-3 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white transition-all transform hover:scale-105 active:scale-95',
      variantClasses,
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    ]"
    @click="$emit('click', $event)"
  >
    <slot>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="iconPath" />
      </svg>
    </slot>
  </button>
</template>

<script setup lang="ts">
/**
 * ActionButton Component
 * 
 * Componente de botão reutilizável com tamanho e formato consistentes.
 * Usado para botões de ação como Enviar e Upload.
 * 
 * @component
 * @prop {string} variant - Variante do botão: 'primary' (azul) ou 'secondary' (roxo)
 * @prop {string} type - Tipo do botão HTML: 'button' | 'submit'
 * @prop {boolean} disabled - Se o botão está desabilitado
 * @prop {string} ariaLabel - Label de acessibilidade
 * @prop {string} iconPath - Path SVG do ícone (opcional)
 * @emits {click} Emitido quando o botão é clicado
 * 
 * @example
 * <ActionButton variant="primary" type="submit" :disabled="loading">
 *   <svg>...</svg>
 * </ActionButton>
 */

interface Props {
  variant?: 'primary' | 'secondary'
  type?: 'button' | 'submit'
  disabled?: boolean
  ariaLabel?: string
  iconPath?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  type: 'button',
  disabled: false,
  ariaLabel: '',
  iconPath: ''
})

defineEmits<{
  click: [event: MouseEvent]
}>()

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 focus:ring-blue-500'
    case 'secondary':
      return 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500'
    default:
      return ''
  }
})
</script>
