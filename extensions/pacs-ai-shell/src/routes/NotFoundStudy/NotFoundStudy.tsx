import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Shown at /notfoundstudy when a viewer link names studies that are not
 * available. Same wording as before; OHIF's own page only links back to the
 * study list when its built-in list is on (appConfig.showStudyList), and the
 * PACS-AI list is ours, so this page replaces it.
 */
const NotFoundStudy = () => {
  return (
    <div className="absolute flex h-full w-full items-center justify-center text-white">
      <div>
        <h4>
          One or more of the requested studies are not available at this time. Return to the{' '}
          <Link
            className="text-primary-light"
            to={`/`}
          >
            study list
          </Link>{' '}
          to select a different study to view.
        </h4>
      </div>
    </div>
  );
};

export default NotFoundStudy;
