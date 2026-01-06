import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'ShowShowShow Docs',
  tagline: 'Intentional TV scheduling for the streaming age',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // For self-hosting, update this to your domain
  url: 'http://localhost:3001',
  baseUrl: '/',

  organizationName: 'rubb3rDucc',
  projectName: 'showshowshow',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    format: 'md', // Use standard markdown, not MDX
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/rubb3rDucc/showshowshow/tree/master/docsite/',
          routeBasePath: '/', // Docs at root
        },
        blog: false, // Disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'ShowShowShow',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'mainSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/rubb3rDucc/showshowshow',
          label: 'GitHub',
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
            { label: 'Getting Started', to: '/getting-started' },
            { label: 'API Reference', to: '/api-reference' },
            { label: 'Deployment', to: '/deployment' },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/rubb3rDucc/showshowshow',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ShowShowShow. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'sql', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
