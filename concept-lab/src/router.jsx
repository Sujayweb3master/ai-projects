import { createBrowserRouter, redirect, useRouteError } from 'react-router'
import AppShell from '@/components/layout/AppShell'
import { conceptsRegistry } from '@/concepts-registry'

const allConcepts = conceptsRegistry.flatMap((group) => group.concepts)

function RootErrorBoundary() {
  const error = useRouteError()

  return (
    <main className="route-message">
      <h1>Something went wrong</h1>
      <p>{error?.statusText || error?.message || 'Please try again.'}</p>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main className="route-message">
      <h1>Concept not found</h1>
      <p>Choose a concept from the sidebar to continue exploring.</p>
    </main>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: AppShell,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        loader: () => redirect(allConcepts[0].path),
      },
      ...allConcepts.map((concept) => ({
        path: concept.path.slice(1),
        lazy: async () => {
          const module = await concept.component()
          console.log(module);

          return { Component: module.default }
        },
      })),
      {
        path: '*',
        Component: NotFoundPage,
      },
    ],
  },
])
