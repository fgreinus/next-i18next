import React from 'react'
import Router from 'next/router'

import { I18nextProvider } from 'react-i18next'
import { lngPathCorrector } from 'utils'
import { NextStaticProvider } from 'components'

import hoistNonReactStatics from 'hoist-non-react-statics'

export default function (WrappedComponent) {

  const { config, i18n } = this

  class AppWithTranslation extends React.Component {

    constructor() {
      super()
      if (config.localeSubpaths) {
        i18n.on('languageChanged', (lng) => {
          if (process.browser) {
            const originalRoute = window.location.pathname
            const [href, as] = lngPathCorrector(config, i18n, originalRoute, lng)
            if (as !== originalRoute) {
              Router.replace(href, as, { shallow: true })
            }
          }
        })
      }
    }

    static async getInitialProps({ Component, ctx }, ...additionalContext) {

      let pageProps = {}
      let regularProps = {}

      if (Component.getInitialProps) {
        pageProps = await Component.getInitialProps(ctx, ...additionalContext)
      }

      // Run getInitialProps on wrapped _app
      if (WrappedComponent.getInitialProps) {
        const { pageProps: wrappedPageProps, ...rest } = await WrappedComponent
          .getInitialProps({ Component, ctx }, ...additionalContext)
        pageProps = {
          ...pageProps,
          ...wrappedPageProps,
        }
        regularProps = rest
      }

      // Initiate vars to return
      const { req } = ctx
      let initialI18nStore = {}
      let initialLanguage = null

      // Load translations to serialize if we're serverside
      if (req && req.i18n) {
        [initialLanguage] = req.i18n.languages
        await i18n.changeLanguage(initialLanguage)
        req.i18n.languages.forEach((l) => {
          initialI18nStore[l] = {}
          i18n.nsFromReactTree.forEach((ns) => {
            initialI18nStore[l][ns] = (req.i18n.services.resourceStore.data[l] || {})[ns] || {}
          })
        })
      } else if (Array.isArray(i18n.languages) && i18n.languages.length > 0) {
        // Load newly-required translations if changing route clientside
        await Promise.all(
          i18n.nsFromReactTree
            .filter(ns => !i18n.hasResourceBundle(i18n.languages[0], ns))
            .map(ns => new Promise(resolve => i18n.loadNamespaces(ns, () => resolve()))),
        )
        initialI18nStore = i18n.store.data
        initialLanguage = i18n.language
      }

      // `pageProps` will get serialized automatically by NextJs
      return {
        initialI18nStore,
        initialLanguage,
        pageProps,
        ...regularProps,
      }
    }

    render() {
      let { initialLanguage, initialI18nStore } = this.props
      if (!process.browser) {
        initialLanguage = i18n.language
        initialI18nStore = i18n.store.data
      }
      return (
        <I18nextProvider
          i18n={i18n}
          initialLanguage={initialLanguage}
          initialI18nStore={initialI18nStore}
        >
          <NextStaticProvider>
            <WrappedComponent {...this.props} />
          </NextStaticProvider>
        </I18nextProvider>
      )
    }
  }

  return hoistNonReactStatics(AppWithTranslation, WrappedComponent, { getInitialProps: true })

}
