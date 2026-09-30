export const conceptsRegistry = [
  {
    category: 'React Hook Form',
    concepts: [
      {
        id: 'rhf-basics',
        title: 'RHF Basics',
        path: '/rhf/basics',
        description:
          'See how useForm connects native inputs through register(), supplies default values, and exposes validation errors.',
        tags: ['useForm', 'register', 'defaultValues', 'formState.errors'],
        component: () => import('@/concepts/rhf-basics/RhfBasicsPage'),
      },
      {
        id: 'rhf-validation-types',
        title: 'Validation Types',
        path: '/rhf/validation-types',
        description:
          'Explore the built-in validation rules React Hook Form accepts through register options.',
        tags: ['required', 'minLength', 'min', 'max', 'pattern'],
        component: () =>
          import('@/concepts/rhf-validation-types/RhfValidationTypesPage'),
      },
      {
        id: 'rhf-custom-validation',
        title: 'Custom Validation',
        path: '/rhf/custom-validation',
        description:
          'Use validate functions for rules that need application logic or values from another field.',
        tags: ['validate', 'getValues', 'cross-field validation'],
        component: () =>
          import('@/concepts/rhf-custom-validation/RhfCustomValidationPage'),
      },
      {
        id: 'rhf-advanced-features',
        title: 'Lesser-Known RHF Tools',
        path: '/rhf/advanced-features',
        description:
          'Tour useful React Hook Form APIs for watching, controlled inputs, dynamic fields, and imperative updates.',
        tags: ['watch', 'useFieldArray', 'useController', 'setValue', 'trigger'],
        component: () =>
          import('@/concepts/rhf-advanced-features/RhfAdvancedFeaturesPage'),
      },
      {
        id: 'rhf-zod-integration',
        title: 'Zod + React Hook Form',
        path: '/rhf/zod-integration',
        description:
          'Connect a Zod schema through zodResolver and keep schema validation errors next to their fields.',
        tags: ['zodResolver', 'z.object', 'refine', 'schema validation'],
        component: () =>
          import('@/concepts/rhf-zod-integration/RhfZodIntegrationPage'),
      },
    ],
  },
  {
    category: 'React Router',
    concepts: [],
  },
]
