import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  studyOpenPath,
  takeViewerStudyToRetrieve,
} from '@pacs-ai/extension-core/src/utils/viewerUrl';

/**
 * Shown at /notfoundstudy when a viewer link names studies that are not
 * available. Same wording as before; OHIF's own page only links back to the
 * study list when its built-in list is on (appConfig.showStudyList), and the
 * PACS-AI list is ours, so this page replaces it.
 *
 * The local store keeps a study about 24 hours. A link that reached /viewer
 * directly (bookmark, browser history, an older link) is sent once to
 * /open-study, which retrieves the study from the PACS like the work list;
 * the message is shown when that was already tried.
 */
const NotFoundStudy = () => {
  const navigate = useNavigate();
  const [retryUID] = useState(() => takeViewerStudyToRetrieve());

  useEffect(() => {
    if (retryUID) {
      navigate(studyOpenPath(retryUID), { replace: true });
    }
  }, [retryUID, navigate]);

  if (retryUID) {
    return null;
  }

  return (
    <div className="absolute flex h-full w-full items-center justify-center text-white">
      <div>
        <h4>
          One or more of the requested studies are not available at this time. Return to the{' '}
          <Link
            className="text-primary"
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
