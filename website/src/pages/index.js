import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

const QUICK_START = `TemporalModule.register({
  connection: { address: 'localhost:7233', namespace: 'default' },
  taskQueue: 'my-task-queue',
  worker: {
    workflowsPath: require.resolve('./workflows'),
    activityClasses: [PaymentActivity],
    autoStart: true,
  },
})`;

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/getting-started">
            Get Started
          </Link>
          <Link className="button button--outline button--secondary button--lg" to="/docs/api">
            API Reference
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            to="https://github.com/hmake98/nestjs-temporal-core"
          >
            View on GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <section className={styles.quickStart}>
          <div className="container">
            <div className="row">
              <div className="col col--6">
                <Heading as="h2">Register once, run anywhere</Heading>
                <p>
                  One dynamic module wires up connection pooling, worker lifecycle, and
                  auto-discovered activities. Client-only, worker-only, and schedules-only
                  variants are available when you don't need the full stack.
                </p>
                <p>
                  <Link to="/docs/getting-started">Read the full Getting Started guide →</Link>
                </p>
              </div>
              <div className="col col--6">
                <CodeBlock language="typescript" title="app.module.ts">
                  {QUICK_START}
                </CodeBlock>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
