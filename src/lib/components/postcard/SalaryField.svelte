<script lang="ts">
  import type { SalaryField } from '$lib/salaryField.svelte';

  let {
    field,
    variant = 'pill',
    id = 'salary',
    label = 'Salary'
  }: {
    field: SalaryField;
    variant?: 'pill' | 'line';
    id?: string;
    label?: string;
  } = $props();
</script>

<div class="pc-salary" data-variant={variant}>
  <label for={id} class="pc-salary-field">
    <span id={`${id}-label`} class="pc-salary-label">{label}</span>
    <span class="pc-salary-input">
      <span aria-hidden="true">$</span>
      <input
        {id}
        aria-labelledby={`${id}-label`}
        name="salary"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        placeholder={variant === 'line' ? '58,000' : 'per year'}
        value={field.text}
        aria-invalid={field.error ? 'true' : undefined}
        aria-describedby={field.error ? `${id}-error` : undefined}
        oninput={field.oninput}
        onblur={field.onblur}
        onkeydown={field.onkeydown}
      />
    </span>
  </label>
  {#if field.error}<p id={`${id}-error`} class="pc-salary-error" role="status">
      {field.error}
    </p>{/if}
</div>

<style>
  .pc-salary {
    position: relative;
    min-width: 0;
  }
  .pc-salary-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .pc-salary-label {
    flex: none;
    color: var(--muted);
  }
  .pc-salary-input {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: baseline;
    gap: 0.125rem;
    color: var(--navy);
    font-weight: 600;
  }
  input {
    min-width: 0;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--navy);
    font-weight: inherit;
    font-variant-numeric: tabular-nums;
    outline: none;
  }
  input::placeholder {
    color: #8794a3;
    font-weight: 500;
  }
  [data-variant='pill'] .pc-salary-field {
    height: 2.75rem;
    padding: 0 1rem;
    border: 1.5px solid var(--navy);
    border-radius: 999px;
    background: #fff;
    font-size: 0.9375rem;
  }
  [data-variant='pill'] .pc-salary-field:focus-within {
    outline: 2px solid var(--navy);
    outline-offset: 2px;
  }
  [data-variant='pill'] input {
    width: 5.5rem;
  }
  [data-variant='line'] .pc-salary-field {
    display: block;
    padding: 0.625rem 0 0.375rem;
    border-bottom: 1.5px solid var(--navy);
  }
  [data-variant='line'] .pc-salary-field:focus-within {
    border-bottom-width: 3px;
    padding-bottom: calc(0.375rem - 1.5px);
  }
  [data-variant='line'] .pc-salary-label {
    display: block;
    font-size: 0.8125rem;
  }
  [data-variant='line'] .pc-salary-input {
    padding: 2px 0;
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
  }
  .pc-salary-error {
    margin: 0.375rem 0 0;
    color: var(--red);
    font-size: 0.8125rem;
  }
  [data-variant='pill'] .pc-salary-error {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 5;
    width: max-content;
    max-width: 18rem;
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    background: var(--red);
    color: #fff;
  }
  @media (max-width: 600px) {
    [data-variant='pill'] input {
      width: 100%;
    }
    [data-variant='line'] .pc-salary-input {
      font-size: 1.625rem;
    }
  }
</style>
