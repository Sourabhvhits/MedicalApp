import * as Yup from 'yup';

export const initialValues = {
  status: 'ALL',
  search: '',
  isLoading: false,
};

export const formSchema = Yup.object().shape({
  status: Yup.string(),
  search: Yup.string(),
});
