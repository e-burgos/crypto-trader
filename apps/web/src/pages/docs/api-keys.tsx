import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsSteps,
  DocsCallout,
  DocsCodeBlock,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { Key } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsApiKeysPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('api-keys');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.integration', 'Integration')}
        page={t('docs.apiKeys.title', 'API Keys')}
      />

      <DocsSectionHeader id="api-keys" icon={<Key className="h-5 w-5" />}>
        {t('docs.apiKeys.title', 'API Keys')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.apiKeys.intro',
          'How to generate, configure, and secure your API keys for Binance and LLM providers.',
        )}
      </p>

      {/* Binance API keys */}
      <h2 id="binance-keys" className="mb-3 text-lg font-semibold">
        {t('docs.apiKeys.binanceTitle', 'Binance API keys')}
      </h2>
      <DocsSteps
        steps={[
          {
            title: t(
              'docs.apiKeys.binanceStep1',
              'Log in to your Binance account',
            ),
          },
          {
            title: t(
              'docs.apiKeys.binanceStep2',
              'Go to API Management (Settings → API Management)',
            ),
          },
          {
            title: t(
              'docs.apiKeys.binanceStep3',
              'Click "Create API" — choose System Generated',
            ),
          },
          {
            title: t(
              'docs.apiKeys.binanceStep4',
              'Enable "Read Info" and "Enable Trading" ONLY',
            ),
            description: t(
              'docs.apiKeys.binanceStep4Desc',
              'Never enable Withdrawals or Universal Transfer',
            ),
          },
          {
            title: t(
              'docs.apiKeys.binanceStep5',
              'Set IP restrictions for additional security',
            ),
            description: t(
              'docs.apiKeys.binanceStep5Desc',
              "Restrict to your server's IP address if self-hosting",
            ),
          },
          {
            title: t(
              'docs.apiKeys.binanceStep6',
              'Copy both the API Key and Secret Key',
            ),
          },
        ]}
      />
      <DocsCallout
        variant="danger"
        title={t('docs.apiKeys.secretWarning', 'Secret key shown once')}
      >
        {t(
          'docs.apiKeys.secretWarningDesc',
          'The Secret Key is only shown once at creation. Save it immediately in a secure location. If lost, you must delete the key and create a new one.',
        )}
      </DocsCallout>

      {/* Testnet keys */}
      <h2 id="testnet-keys" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.apiKeys.testnetTitle', 'Testnet API keys')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.apiKeys.testnetDesc',
          'For TESTNET mode, you need keys from the Binance Testnet — a separate environment from production.',
        )}
      </p>
      <DocsSteps
        steps={[
          {
            title: t(
              'docs.apiKeys.testnetStep1',
              'Go to testnet.binance.vision',
            ),
            description: t(
              'docs.apiKeys.testnetStep1Desc',
              'This is the Binance Spot Test Network',
            ),
          },
          {
            title: t(
              'docs.apiKeys.testnetStep2',
              'Log in with your GitHub account',
            ),
          },
          { title: t('docs.apiKeys.testnetStep3', 'Generate HMAC_SHA256 Key') },
          {
            title: t(
              'docs.apiKeys.testnetStep4',
              'Copy the API Key and Secret Key',
            ),
          },
        ]}
      />
      <DocsCallout
        variant="info"
        title={t('docs.apiKeys.testnetNote', 'Testnet funds')}
      >
        {t(
          'docs.apiKeys.testnetNoteDesc',
          "Testnet provides free test funds automatically. No real money is involved. Keys are separate from production — you can't accidentally trade real funds with testnet keys.",
        )}
      </DocsCallout>

      {/* LLM keys */}
      <h2 id="llm-keys" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.apiKeys.llmTitle', 'LLM provider keys')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.apiKeys.llmDesc',
          'Each LLM provider requires its own API key. OpenRouter is recommended as it gives access to 300+ models with a single key.',
        )}
      </p>
      <DocsCodeBlock
        code={`OpenRouter:  openrouter.ai/keys     → starts with sk-or-\nOpenAI:     platform.openai.com    → starts with sk-\nAnthropic:  console.anthropic.com  → starts with sk-ant-\nGoogle:     aistudio.google.com    → starts with AIza\nGroq:       console.groq.com       → starts with gsk_\nMistral:    console.mistral.ai     → starts with ...\nTogether:   api.together.xyz       → starts with ...`}
        language="text"
        title={t('docs.apiKeys.keyFormats', 'Key formats by provider')}
      />

      {/* Security */}
      <h2 id="key-security" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.apiKeys.securityTitle', 'Key security best practices')}
      </h2>
      <DocsCallout
        variant="warning"
        title={t(
          'docs.apiKeys.securityBestPractices',
          'Security best practices',
        )}
      >
        <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
          <li>{t('docs.apiKeys.sec1', 'Never share your API keys')}</li>
          <li>
            {t('docs.apiKeys.sec2', 'Use IP restrictions on Binance keys')}
          </li>
          <li>
            {t('docs.apiKeys.sec3', 'Never enable withdrawal permissions')}
          </li>
          <li>{t('docs.apiKeys.sec4', 'Rotate keys periodically')}</li>
          <li>
            {t(
              'docs.apiKeys.sec5',
              'Use separate keys for testnet and production',
            )}
          </li>
          <li>
            {t(
              'docs.apiKeys.sec6',
              'Monitor your Binance API key usage in the Binance dashboard',
            )}
          </li>
        </ul>
      </DocsCallout>

      <DocsPageFeedback
          question={t('docs.feedback.question', 'Was this page helpful?')}
          yesLabel={t('docs.feedback.yes', 'Yes')}
          noLabel={t('docs.feedback.no', 'No')}
          thanksYes={t('docs.feedback.thanksYes', 'Thanks for your feedback!')}
          thanksNo={t('docs.feedback.thanksNo', "Thanks — we'll work on improving this page.")}
        />

      <DocsPagination
        prev={
          prev ? { title: t(SLUG_TITLE_KEY_MAP[prev.slug] ?? prev.slug, prev.title), href: `/docs/${prev.slug}` } : undefined
        }
        next={
          next
            ? {
                title: t(SLUG_TITLE_KEY_MAP[next.slug] ?? next.slug, next.title),
                href: `/docs/${next.slug}`,
                description: next.description,
              }
            : undefined
        }
        previousLabel={t('docs.pagination.previous', 'Previous')}
        nextLabel={t('docs.pagination.next', 'Next')}
        onNavigate={(href) => {
          navigate(href);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
