// @ts-check
const { themes: prismThemes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'NestJS Temporal Core',
  tagline: 'NestJS integration for Temporal.io workflow orchestration',

  url: 'https://hmake98.github.io',
  baseUrl: '/nestjs-temporal-core/',

  organizationName: 'hmake98',
  projectName: 'nestjs-temporal-core',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  markdown: {
    format: 'detect',
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/docs',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl:
            'https://github.com/hmake98/nestjs-temporal-core/edit/main/website/docs/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-typedoc',
      {
        entryPoints: ['../src/index.ts'],
        tsconfig: '../tsconfig.docs.json',
        out: 'docs/api',
        excludePrivate: true,
        excludeProtected: true,
        readme: 'none',
        watch: false,
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'NestJS Temporal Core',
        items: [
          {
            to: '/',
            position: 'left',
            label: 'Home',
          },
          {
            type: 'docSidebar',
            sidebarId: 'guideSidebar',
            position: 'left',
            label: 'Guide',
          },
          {
            href: 'https://github.com/hmake98/nestjs-temporal-core',
            label: 'GitHub',
            position: 'right',
          },
          {
            href: 'https://www.npmjs.com/package/nestjs-temporal-core',
            label: 'npm',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting Started', to: '/docs/getting-started' },
              { label: 'Core Concepts', to: '/docs/core-concepts' },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub Discussions',
                href: 'https://github.com/hmake98/nestjs-temporal-core/discussions',
              },
              {
                label: 'Issues',
                href: 'https://github.com/hmake98/nestjs-temporal-core/issues',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'npm',
                href: 'https://www.npmjs.com/package/nestjs-temporal-core',
              },
              {
                label: 'Example Project',
                href: 'https://github.com/hmake98/nestjs-temporal-core-example',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} hmake98. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['typescript', 'bash'],
      },
    }),
};

module.exports = config;
