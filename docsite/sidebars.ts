import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  mainSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started',
        'api-reference',
        'curl-cheatsheet',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'data-model',
        'timezone-handling',
        'migration-notes',
      ],
    },
    {
      type: 'category',
      label: 'Features',
      items: [
        'networks',
        'library-feature',
        'settings-page',
      ],
    },
    {
      type: 'category',
      label: 'Design',
      items: [
        'product',
        'quiet-utility-design-spec',
        'llm-constraints',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment',
        {
          type: 'category',
          label: 'Docker',
          items: [
            'deployment/README',
            'deployment/DEPLOYMENT',
            'deployment/DOCKERFILES',
            'deployment/NGINX',
            'deployment/PORTS',
            'deployment/TROUBLESHOOTING',
            'deployment/ACCESS',
          ],
        },
        'deployment/DIGITALOCEAN_BUILD',
      ],
    },
    {
      type: 'category',
      label: 'Testing',
      items: [
        'testing/README',
        'testing/TEST_STRATEGY',
        'testing/IMPLEMENTATION',
        'testing/QUICK_TEST',
      ],
    },
    {
      type: 'category',
      label: 'Security',
      items: [
        'security',
        'security-improvements',
      ],
    },
    {
      type: 'category',
      label: 'Roadmap',
      collapsed: true,
      items: [
        'future-features',
        'queue-bulk-operations',
        'queue-selection-filtering',
        'schedule-calendar-views',
        'schedule-drag-and-drop',
        'stats-metrics-implementation',
        'redis-caching-implementation',
        'onboarding-flow',
        'gdpr-compliance-todo',
      ],
    },
    {
      type: 'category',
      label: 'Business',
      collapsed: true,
      items: [
        'monetization-strategy',
        'pricing-and-monetization',
        'launch-checklist',
        'landing-page-strategy',
        'tiktok-marketing-strategy',
      ],
    },
    {
      type: 'category',
      label: 'Audits',
      collapsed: true,
      items: [
        'optimization-audit',
        'security-and-observability-audit',
        'testing-infrastructure-audit',
        'infrastructure-cost-scaling-audit',
        'production-blinspots',
      ],
    },
    'whats-new',
  ],
};

export default sidebars;
