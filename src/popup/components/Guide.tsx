import React from 'react';
import { t } from '../i18n';

interface GuideProps {
  onClose: () => void;
}

/**
 * Step-by-step interactive guide for first-time users.
 * Highlights the key features of the extension.
 */
export function Guide({ onClose }: GuideProps) {
  return (
    <div className="guide-overlay" onClick={onClose}>
      <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('guideTitle')}</h2>

        <div className="guide-step">
          <span className="step-number">1</span>
          <strong>{t('guideStep1Title')}</strong>
          <p>{t('guideStep1Desc')}</p>
        </div>

        <div className="guide-step">
          <span className="step-number">2</span>
          <strong>{t('guideStep2Title')}</strong>
          <p>{t('guideStep2Desc')}</p>
        </div>

        <div className="guide-step">
          <span className="step-number">3</span>
          <strong>{t('guideStep3Title')}</strong>
          <p>{t('guideStep3Desc')}</p>
        </div>

        <div className="guide-step">
          <span className="step-number">4</span>
          <strong>{t('guideStep4Title')}</strong>
          <p>{t('guideStep4Desc')}</p>
        </div>

        <div className="guide-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
}
