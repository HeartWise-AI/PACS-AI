import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Shown for any path no route matches (the `notFoundRoute` of our
 * routes.customRoutes). OHIF 3.13 added a 404 page at `path: '*'`, but its
 * "Return to Study List" button is shown only when OHIF's own study list is
 * on (appConfig.showStudyList), and the PACS-AI work list is ours; on 3.11.1
 * such paths rendered an empty page.
 */
const NotFound = () => {
  return (
    <div className="absolute flex h-full w-full items-center justify-center text-white">
      <div data-cy="pacs-ai-not-found">
        <h4>
          Error (404): we can&apos;t find the page you&apos;re looking for. Return to the{' '}
          <Link
            className="text-primary-light"
            to="/"
          >
            study list
          </Link>
          .
        </h4>
      </div>
    </div>
  );
};

export default NotFound;
