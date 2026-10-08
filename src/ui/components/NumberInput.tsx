import React, { useState, useEffect } from 'react';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChangeValue: (val: number) => void;
  fallbackValue?: number;
}

export const NumberInput: React.FC<NumberInputProps> = ({ 
  value, 
  onChangeValue, 
  fallbackValue = 1,
  ...props 
}) => {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  return (
    <input
      type="number"
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        const num = parseInt(e.target.value, 10);
        if (!isNaN(num)) {
          // Allow typing, but only trigger valid changes
          if ((props.min === undefined || num >= Number(props.min)) && (props.max === undefined || num <= Number(props.max))) {
            onChangeValue(num);
          }
        }
      }}
      onBlur={() => {
        const num = parseInt(localValue, 10);
        if (!localValue || isNaN(num) || (props.min !== undefined && num < Number(props.min)) || (props.max !== undefined && num > Number(props.max))) {
          setLocalValue(fallbackValue.toString());
          onChangeValue(fallbackValue);
        } else {
          setLocalValue(num.toString()); // cleanup leading zeros
        }
      }}
      {...props}
    />
  );
};
