import React from 'react';

interface ContextListProps {
  context: string[];
  onContextChange: (newContext: string[]) => void;
  errors?: string[];
  contextRequired?: boolean;
}

export const ContextList: React.FC<ContextListProps> = ({
  context,
  onContextChange,
  errors = [],
  contextRequired = true,
}) => {
  const handleContextInputChange = (index: number, value: string) => {
    const newContext = [...context];
    newContext[index] = value;
    onContextChange(newContext);
  };

  const handleAddContext = () => {
    onContextChange([...context, '']);
  };

  const handleDeleteContext = (index: number) => {
    const newContext = context.filter((_, i) => i !== index);
    onContextChange(newContext);
  };

  return (
    <div className="llm-eval-form-group">
      <label className="llm-eval-form-label">
        Retrieval from RAG or from document
        {contextRequired && <span className="llm-eval-required">*</span>}
      </label>
      <div className="llm-eval-context-list">
        {context.map((contextItem, index) => (
          <div key={index} className="llm-eval-context-item">
            <input
              type="text"
              className={`llm-eval-input ${
                errors[index] && errors[index] !== '' ? 'llm-eval-input-error' : ''
              }`}
              placeholder={`Context ${index + 1}`}
              value={contextItem}
              onChange={(e) => handleContextInputChange(index, e.target.value)}
            />
            <button
              type="button"
              className="llm-eval-context-delete-btn"
              onClick={() => handleDeleteContext(index)}
              title="Delete context"
            >
              🗑️
            </button>
            {errors[index] && errors[index] !== '' && (
              <span className="llm-eval-error-message">{errors[index]}</span>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="llm-eval-btn llm-eval-btn-primary llm-eval-add-context-btn"
        onClick={handleAddContext}
      >
        + Add Context
      </button>
    </div>
  );
};
