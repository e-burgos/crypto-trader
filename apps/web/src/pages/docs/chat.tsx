import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsTable,
  DocsCallout,
  DocsSteps,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { BotMessageSquare } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('chat');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.platform', 'Platform')}
        page={t('docs.chat.title', 'Multi-Agent Chat')}
      />

      <DocsSectionHeader
        id="chat"
        icon={<BotMessageSquare className="h-5 w-5" />}
      >
        {t('docs.chat.title', 'Multi-Agent Chat')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.chat.intro',
          'The Chat page gives you direct access to the multi-agent system for conversational interaction. Ask questions about the platform, request market analysis, or get explanations of recent decisions.',
        )}
      </p>

      <DocsCallout
        variant="tip"
        title={t('docs.chat.useCaseTitle', 'What to use Chat for')}
      >
        {t(
          'docs.chat.useCaseDesc',
          'Chat is ideal for: understanding a specific decision the agent made, asking for a market analysis on demand, learning about platform features, or troubleshooting configuration.',
        )}
      </DocsCallout>

      {/* Sessions */}
      <h2 id="chat-sessions" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.chat.sessionsTitle', 'Chat sessions')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.chat.sessionsDesc',
          'Conversations are organized into sessions. Each session maintains its own context — the AI remembers what was discussed within a session. You can create multiple sessions to keep different conversations separate.',
        )}
      </p>
      <DocsSteps
        steps={[
          {
            title: t('docs.chat.sessionStep1', 'Sessions panel'),
            description: t(
              'docs.chat.sessionStep1Desc',
              'The left sidebar (collapsible on mobile) shows all your sessions. Click one to load it.',
            ),
          },
          {
            title: t('docs.chat.sessionStep2', 'New session'),
            description: t(
              'docs.chat.sessionStep2Desc',
              'Typing your first message in an empty input automatically creates a new session titled with the beginning of your message.',
            ),
          },
          {
            title: t('docs.chat.sessionStep3', 'Session persistence'),
            description: t(
              'docs.chat.sessionStep3Desc',
              'Sessions are saved permanently. Return to any previous conversation to continue the context.',
            ),
          },
        ]}
      />

      {/* Capabilities */}
      <h2 id="capabilities" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.chat.capabilitiesTitle', 'Capability shortcuts')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.chat.capabilitiesDesc',
          'Above the input field, quick-action buttons inject structured context into your message automatically. This gives the agents the data they need without you having to describe it.',
        )}
      </p>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.chat.capability', 'Capability'),
          t('docs.chat.whatItDoes', 'What it does'),
          t('docs.chat.bestFor', 'Best for'),
        ]}
        rows={[
          [
            t('docs.chat.capAnalysis', 'Market Analysis'),
            t(
              'docs.chat.capAnalysisDesc',
              'Attaches current market snapshot: price, indicators, recent candles',
            ),
            t(
              'docs.chat.capAnalysisFor',
              '"Why did the agent BUY?" or "What does the market look like now?"',
            ),
          ],
          [
            t('docs.chat.capNews', 'News Analysis'),
            t(
              'docs.chat.capNewsDesc',
              'Attaches recent crypto news headlines and their sentiment scores',
            ),
            t(
              'docs.chat.capNewsFor',
              '"What news is driving BTC today?" or sentiment analysis',
            ),
          ],
          [
            t('docs.chat.capTrades', 'Trade History'),
            t(
              'docs.chat.capTradesDesc',
              'Attaches recent agent decisions and executed trades',
            ),
            t(
              'docs.chat.capTradesFor',
              '"Analyze my last 10 trades" or strategy review',
            ),
          ],
        ]}
      />

      {/* Agent selection */}
      <h2 id="agent-selection" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.chat.agentSelectionTitle', 'Choosing an agent')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.chat.agentSelectionDesc',
          'By default, NEXUS (the platform expert) handles general questions. You can switch to a specific agent using the agent selector dropdown above the chat. Each agent excels in its domain:',
        )}
      </p>
      <DocsTable
        headers={[
          t('docs.chat.agent', 'Agent'),
          t('docs.chat.bestAt', 'Best for asking about'),
        ]}
        rows={[
          [
            'NEXUS',
            t(
              'docs.chat.nexusBest',
              'Platform features, settings, how-to questions',
            ),
          ],
          [
            'FORGE',
            t(
              'docs.chat.forgeBest',
              'Trade execution, order management, portfolio operations',
            ),
          ],
          [
            'SIGMA',
            t(
              'docs.chat.sigmaBest',
              'Market analysis, technical indicators, price action',
            ),
          ],
          [
            'CIPHER',
            t(
              'docs.chat.cipherBest',
              'Blockchain data, on-chain metrics, crypto fundamentals',
            ),
          ],
          [
            'AEGIS',
            t(
              'docs.chat.aegisBest',
              'Risk management, position sizing, drawdown analysis',
            ),
          ],
        ]}
      />

      {/* Orchestrating indicator */}
      <h2 id="orchestrating" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.chat.orchestratingTitle', 'Orchestrating indicator')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.chat.orchestratingDesc',
          'When you send a complex message, you may see an "Orchestrating..." indicator. This means KRYPTO is routing your request to the most appropriate specialist agent. The step shown (e.g., "Consulting SIGMA...") tells you which agent is currently working on your query.',
        )}
      </p>
      <DocsCallout
        variant="info"
        title={t('docs.chat.streamingNote', 'Streaming responses')}
      >
        {t(
          'docs.chat.streamingNoteDesc',
          'Responses stream in real-time as the AI generates them. You can see the text appear word by word. If you want to stop the response early, click the Stop button.',
        )}
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
