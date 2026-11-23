import * as Yup from 'yup';

export const initialValues = {
  reason: '',
  isLoading: false,
};

export const formSchema = Yup.object().shape({
  reason: Yup.string()
    .trim()
    .required('Please provide a reason for cancellation')
    .min(3, 'Reason must be at least 3 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
});
