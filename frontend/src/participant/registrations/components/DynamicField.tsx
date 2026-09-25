import { useController, useFormContext } from 'react-hook-form';
import { TextField, MenuItem, FormControl, InputLabel, Select, RadioGroup, FormControlLabel, Radio, Checkbox, FormHelperText, Box, Typography } from '@mui/material';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';

const typeIcons = {
  text: 'text_fields',
  email: 'email',
  tel: 'phone',
  textarea: 'description',
  radio: 'radio_button_checked',
  checkbox: 'check_box',
};

function DropdownArrowIcon(props) {
  return <ArrowDropDown {...props} />;
}

export default function DynamicField({ field, register }) {
  const { control, formState: { errors, touchedFields } } = useFormContext();
  const { field: controllerField, fieldState: { error } } = useController({
    name: field.name,
    control,
    rules: { required: field.required ? `${field.label} is required` : false },
    defaultValue: field.type === 'checkbox' ? [] : '',
  });

  const isTouched = touchedFields[field.name];
  const showError = isTouched && error;

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
            helperText={showError ? error.message : field.description}
            size="small"
            variant="outlined"
            InputProps={{
              startAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, color: 'text.secondary' }}>
                  <span>{typeIcons.text}</span>
                </Box>
              ),
            }}
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
            helperText={showError ? error.message : field.description}
            size="small"
            variant="outlined"
            InputProps={{
              startAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, color: 'text.secondary' }}>
                  <span>{typeIcons.email}</span>
                </Box>
              ),
            }}
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
            helperText={showError ? error.message : field.description}
            size="small"
            variant="outlined"
            InputProps={{
              startAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, color: 'text.secondary' }}>
                  <span>{typeIcons.tel}</span>
                </Box>
              ),
            }}
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
            helperText={showError ? error.message : field.description}
            size="small"
            variant="outlined"
            InputProps={{
              startAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mr: 1, color: 'text.secondary', mt: 1 }}>
                  <span>{typeIcons.textarea}</span>
                </Box>
              ),
            }}
          />
        );
      }
      case 'dropdown': {
        return (
          <FormControl fullWidth error={!!showError} size="small" variant="outlined" required={!!field.required}>
            <InputLabel shrink>{field.label}</InputLabel>
            <Select
              {...controllerField}
              value={controllerField.value ?? ''}
              label={field.label}
              displayEmpty
              IconComponent={DropdownArrowIcon}
              renderValue={(selected) =>
                selected ? (
                  selected
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
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
            {showError && <FormHelperText>{error?.message || `${field.label} is required`}</FormHelperText>}
            {!showError && field.description && <FormHelperText>{field.description}</FormHelperText>}
          </FormControl>
        );
      }
      case 'radio': {
        return (
          <Box>
            <FormControl component="fieldset" fullWidth error={showError} size="small" variant="outlined">
              <Box component="legend" sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'text.primary', mb: 1 }}>
                {field.label}
                {field.required && <Typography component="span" variant="caption" color="error" sx={{ ml: 0.5 }}>*</Typography>}
              </Box>
              <RadioGroup
                {...controllerField}
                row
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, px: 1, py: 1 }}
              >
                {field.options?.map((option) => (
                  <FormControlLabel
                    key={option}
                    value={option}
                    control={<Radio color="primary" />}
                    label={option}
                    labelPlacement="end"
                    sx={{ minWidth: '180px', cursor: 'pointer' }}
                  />
                ))}
              </RadioGroup>
            </FormControl>
            {showError && <FormHelperText>{error.message}</FormHelperText>}
            {!showError && field.description && <FormHelperText>{field.description}</FormHelperText>}
          </Box>
        );
      }
      case 'checkbox': {
        return (
          <Box>
            <Typography variant="body2" fontWeight={500} color="text.primary" gutterBottom>
              {field.label}
              {field.required && <Typography component="span" variant="caption" color="error" sx={{ ml: 0.5 }}>*</Typography>}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, ml: 1 }}>
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
                          : current.filter((v) => v !== option);
                        controllerField.onChange(newValue);
                      }}
                      checked={(controllerField.value || []).includes(option)}
                    />
                  }
                  label={option}
                  labelPlacement="end"
                  sx={{ minWidth: '180px', cursor: 'pointer' }}
                />
              ))}
            </Box>
            {showError && <FormHelperText>{error.message}</FormHelperText>}
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
            helperText={showError ? error.message : field.description}
            size="small"
            variant="outlined"
          />
        );
      }
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      {renderInput()}
    </Box>
  );
}