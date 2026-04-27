import { useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DocsSidebar, DocsSearch, DocsTOC } from '@crypto-trader/ui';
import { NavbarDocsContainer } from '../../containers/navbar-docs-container';
import { DOCS_PAGES, buildSidebarGroups, SLUG_TITLE_KEY_MAP } from './index';

const GROUP_KEY_MAP: Record<string, string> = {
  'Getting Started': 'docs.group.gettingStarted',
  Platform: 'docs.group.platform',
  Integrations: 'docs.group.integrations',
  Configuration: 'docs.group.configuration',
  Support: 'docs.group.support',
};

export function DocsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Extract active slug from pathname: /docs/quickstart → quickstart
  const activeSlug =
    location.pathname.replace(/^\/docs\/?/, '').split('/')[0] || 'quickstart';

  const sidebarGroups = buildSidebarGroups(DOCS_PAGES).map((group) => ({
    ...group,
    label: t(GROUP_KEY_MAP[group.label] ?? group.label, group.label),
    links: group.links.map((link) => ({
      ...link,
      label: t(SLUG_TITLE_KEY_MAP[link.slug] ?? link.label, link.label),
    })),
  }));

  const handleNavigate = useCallback(
    (slug: string) => {
      navigate(`/docs/${slug}`);
      // Scroll to top of content
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigate],
  );

  const handleSearchSelect = useCallback(
    (slug: string) => {
      navigate(`/docs/${slug}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigate],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Unified docs navbar with integrated search */}
      <NavbarDocsContainer
        docsTitle={t('help.title', 'Documentation')}
        searchSlot={
          <DocsSearch
            pages={DOCS_PAGES.map((p) => ({
              slug: p.slug,
              title: t(SLUG_TITLE_KEY_MAP[p.slug] ?? p.title, p.title),
              description: p.description,
              group: t(GROUP_KEY_MAP[p.group] ?? p.group, p.group),
              keywords: p.keywords,
            }))}
            onSelect={handleSearchSelect}
            placeholder={t(
              'docs.search.placeholder',
              'Search documentation...',
            )}
            noResultsText={t('docs.search.noResults', 'No results found')}
          />
        }
      />

      {/* 3-column layout */}
      <div className="flex gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Left — Sidebar */}
        <DocsSidebar
          groups={sidebarGroups}
          activeSlug={activeSlug}
          onNavigate={handleNavigate}
        />

        {/* Center — Content */}
        <main className="min-w-0 flex-1 max-w-3xl mx-auto" data-docs-content>
          <Outlet />
        </main>

        {/* Right — TOC */}
        <DocsTOC
          title={t('docs.toc.title', 'On this page')}
          triggerKey={activeSlug}
        />
      </div>
    </div>
  );
}
