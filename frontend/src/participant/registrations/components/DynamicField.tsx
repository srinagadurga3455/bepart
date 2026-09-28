import { useController, useFormContext } from 'react-hook-form';
import type { UseFormRegister, FieldValues } from 'react-hook-form';
import { TextField, MenuItem, FormControl, InputLabel, Select, RadioGroup, FormControlLabel, Radio, Checkbox, FormHelperText, Box, Typography } from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import type { FormFieldDef } from '../../../app/types';

type DynamicFieldDef = FormFieldDef & { description?: string };

function DropdownArrowIcon(props: SvgIconProps) {
  return <ArrowDropDown {...props} />;
}

interface DynamicFieldProps {
  field: DynamicFieldDef;
  register?: UseFormRegister<FieldValues>;
}

const inputSx = {
  width: '100%',
  maxWidth: '100%',
  '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 },
  '& .MuiOutlinedInput-input': { minWidth: 0, textOverflow: 'ellipsis' },
};

export default function DynamicField({ field }: DynamicFieldProps) {
  const { control, formState: { errors, touchedFields } } = useFormContext();
  const { field: controllerField, fieldState: { error } } = useController({
    name: field.name,
    control,
    rules: { required: field.required ? `${field.label} is required` : false },
    defaultValue: field.type === 'checkbox' ? [] : '',
  });

  const isTouched = touchedFields[field.name];
  const fieldError = isTouched ? error : undefined;
  const showError = !!fieldError;

  const renderInput = () => {
    switch (field.type) {
      case 'text': {
        return (
          <TextField
            {...controllerField}
            label={field.label}
            type="text"
            fullWidth
            error={showError}
            helperText={showError ? fieldError?.message : field.description}
            size="small"
            variant="outlined"
            autoComplete="off"
            sx={inputSx}
          />
        );
      }
      case 'email': {
        return (
          <TextField
            {...controllerField}
            label={field.label}
            type="email"
            fullWidth
            error={showError}
            helperText={showError ? fieldError?.message : field.description}
            size="small"
            variant="outlined"
            inputMode="email"
            autoComplete="email"
            sx={inputSx}
          />
        );
      }
      case 'tel': {
        return (
          <TextField
            {...controllerField}
            label={field.label}
            type="tel"
            fullWidth
            error={showError}
            helperText={showError ? fieldError?.message : field.description}
            size="small"
            variant="outlined"
            inputMode="tel"
            autoComplete="tel"
            placeholder="e.g. 9876543210"
            sx={inputSx}
          />
        );
      }
      case 'textarea': {
        return (
          <TextField
            {...controllerField}
            label={field.label}
            multiline
            rows={3}
            fullWidth
            error={showError}
            helperText={showError ? fieldError?.message : field.description}
            size="small"
            variant="outlined"
            sx={inputSx}
          />
        );
      }
      case 'dropdown': {
        return (
          <FormControl fullWidth error={showError} size="small" variant="outlined" required={!!field.required} sx={{ maxWidth: '100%' }}>
            <InputLabel shrink>{field.label}</InputLabel>
            <Select
              {...controllerField}
              value={controllerField.value ?? ''}
              label={field.label}
              displayEmpty
              IconComponent={DropdownArrowIcon}
              sx={{ borderRadius: 2, fontSize: 14 }}
              renderValue={(selected: unknown) =>
                selected ? (
                  String(selected)
                ) : (
                  <Typography component="span" color="text.secondary">
                    Select {field.label}
                  </Typography>
                )
              }
            >
              <MenuItem value="" disabled>
                <Typography component="span" color="text.secondary">
                  Select {field.label}
                </Typography>
              </MenuItem>
              {field.options?.map((option) => (
                <MenuItem key={option} value={option} sx={{ whiteSpace: 'normal' }}>{option}</MenuItem>
              ))}
            </Select>
            {showError && <FormHelperText>{fieldError?.message || `${field.label} is required`}</FormHelperText>}
            {!showError && field.description && <FormHelperText>{field.description}</FormHelperText>}
          </FormControl>
        );
      }
      case 'radio': {
        return (
          <Box sx={{ maxWidth: '100%' }}>
            <FormControl component="fieldset" fullWidth error={showError} size="small" variant="outlined">
              <Box component="legend" sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'text.primary', mb: 1 }}>
                {field.label}
                {field.required && <Typography component="span" variant="caption" color="error" sx={{ ml: 0.5 }}>*</Typography>}
              </Box>
              <RadioGroup
                {...controllerField}
                sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: { xs: 0, sm: 2 } }}
              >
                {field.options?.map((option) => (
                  <FormControlLabel
                    key={option}
                    value={option}
                    control={<Radio color="primary" />}
                    label={<Typography sx={{ fontSize: 14, overflowWrap: 'anywhere' }}>{option}</Typography>}
                    labelPlacement="end"
                    sx={{ mr: 2, maxWidth: '100%' }}
                  />
                ))}
              </RadioGroup>
            </FormControl>
            {showError && <FormHelperText>{fieldError?.message}</FormHelperText>}
            {!showError && field.description && <FormHelperText>{field.description}</FormHelperText>}
          </Box>
        );
      }
      case 'checkbox': {
        return (
          <Box sx={{ maxWidth: '100%' }}>
            <Typography variant="body2" color="text.primary" gutterBottom sx={{ fontWeight: 500 }}>
              {field.label}
              {field.required && <Typography component="span" variant="caption" color="error" sx={{ ml: 0.5 }}>*</Typography>}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: { xs: 0, sm: 2 } }}>
              {field.options?.map((option) => (
                <FormControlLabel
                  key={option}
                  value={option}
                  control={
                    <Checkbox
                      {...controllerField}
                      color="primary"
                      onChange={(e) => {
                        const current = controllerField.value || [];
                        const newValue = e.target.checked
                          ? [...current, option]
                          : current.filter((v: unknown) => v !== option);
                        controllerField.onChange(newValue);
                      }}
                      checked={(controllerField.value || []).includes(option)}
                    />
                  }
                  label={<Typography sx={{ fontSize: 14, overflowWrap: 'anywhere' }}>{option}</Typography>}
                  labelPlacement="end"
                  sx={{ mr: 2, maxWidth: '100%' }}
                />
              ))}
            </Box>
            {showError && <FormHelperText>{fieldError?.message}</FormHelperText>}
            {!showError && field.description && <FormHelperText>{field.description}</FormHelperText>}
          </Box>
        );
      }
      default: {
        return (
          <TextField
            {...controllerField}
            label={field.label}
            fullWidth
            error={showError}
            helperText={showError ? fieldError?.message : field.description}
            size="small"
            variant="outlined"
            sx={inputSx}
          />
        );
      }
    }
  };

  return (
    <Box sx={{ mb: 3, maxWidth: '100%', minWidth: 0 }}>
      {renderInput()}
    </Box>
  );
}
