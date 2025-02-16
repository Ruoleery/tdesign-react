import React, { useRef, useImperativeHandle } from 'react';
import classNames from 'classnames';
import isEmpty from 'lodash/isEmpty';
import isFunction from 'lodash/isFunction';
import flatten from 'lodash/flatten';
import useConfig from '../_util/useConfig';
import noop from '../_util/noop';
import forwardRefWithStatics from '../_util/forwardRefWithStatics';
import { TdFormProps, FormInstance, Result } from './type';
import { StyledProps } from '../common';
import FormContext from './FormContext';
import FormItem from './FormItem';

export interface FormProps extends TdFormProps, StyledProps {
  children?: React.ReactNode;
}

export interface FormRefInterface extends React.RefObject<unknown>, FormInstance {
  currentElement: HTMLFormElement;
}

const Form = forwardRefWithStatics(
  (props: FormProps, ref) => {
    const {
      style,
      className,
      labelWidth = '100px',
      statusIcon,
      labelAlign = 'right',
      layout = 'vertical',
      size = 'medium',
      colon = false,
      requiredMark = true,
      scrollToFirstError,
      showErrorMessage = true,
      resetType = 'empty',
      rules,
      children,
      onSubmit,
      onReset,
      onValuesChange = noop,
    } = props;
    const { classPrefix } = useConfig();
    const formClass = classNames(className, `${classPrefix}-form`, {
      [`${classPrefix}-form-inline`]: layout === 'inline',
    });

    const formRef = useRef();
    const formItemsRef = useRef([]);

    const FORM_ITEM_CLASS_PREFIX = `${classPrefix}-form-item__`;

    function getFirstError(r: Result) {
      if (r === true) return;
      const [firstKey] = Object.keys(r);
      if (scrollToFirstError) {
        scrollTo(`.${FORM_ITEM_CLASS_PREFIX + firstKey}`);
      }
      return r[firstKey][0]?.message;
    }
    // 校验不通过时，滚动到第一个错误表单
    function scrollTo(selector: string) {
      const dom = document.querySelector(selector);
      const behavior = scrollToFirstError as ScrollBehavior;
      dom && dom.scrollIntoView({ behavior });
    }

    function submitHandler(e: React.FormEvent<HTMLFormElement>) {
      e?.preventDefault();
      validate().then((r) => {
        getFirstError(r);
        onSubmit?.({ validateResult: r, e });
      });
    }
    function resetHandler(e: React.FormEvent<HTMLFormElement>) {
      e?.preventDefault();
      formItemsRef.current.forEach(({ current: formItemRef }) => {
        if (formItemRef && isFunction(formItemRef.resetField)) {
          formItemRef.resetField();
        }
      });
      onReset?.({ e });
    }

    // 对外方法，该方法会触发全部表单组件错误信息显示
    function validate(param?: Record<string, any>): Promise<Result> {
      function needValidate(name: string, fields: string[]) {
        if (!fields || !Array.isArray(fields)) return true;
        return fields.indexOf(name) !== -1;
      }

      const { fields, trigger = 'all' } = param || {};
      const list = formItemsRef.current
        .filter(
          ({ current: formItemRef }) =>
            formItemRef && isFunction(formItemRef.validate) && needValidate(formItemRef.name, fields),
        )
        .map(({ current: formItemRef }) => formItemRef.validate(trigger));

      return new Promise((resolve) => {
        Promise.all(flatten(list))
          .then((arr: any) => {
            const r = arr.reduce((r, err) => Object.assign(r || {}, err), {});
            Object.keys(r).forEach((key) => {
              if (r[key] === true) {
                delete r[key];
              }
            });
            resolve(isEmpty(r) ? true : r);
          })
          .catch(console.error);
      });
    }

    // 对外方法，获取整个表单的值
    function getAllFieldsValue() {
      const fieldsValue = {};
      formItemsRef.current.forEach(({ current: formItemRef }) => {
        // 过滤无 name 的数据
        if (formItemRef?.name) {
          fieldsValue[formItemRef.name] = formItemRef.value;
        }
      });

      return fieldsValue;
    }

    // 对外方法，获取对应 formItem 的值
    function getFieldValue(name: string) {
      if (!name) return null;
      const target = formItemsRef.current.find(({ current: formItemRef }) => formItemRef?.name === name);
      return target && target.value;
    }

    // 对外方法，设置对应 formItem 的值
    function setFieldsValue(fileds = {}) {
      const formItemsMap = formItemsRef.current.reduce((acc, { current: currItem }) => {
        if (currItem?.name) {
          const { name } = currItem;
          return { ...acc, [name]: currItem };
        }
        return acc;
      }, {});
      Object.keys(fileds).forEach((key) => {
        formItemsMap[key]?.setValue(fileds[key]);
      });
    }

    // 对外方法，设置对应 formItem 的数据
    function setFields(fileds = []) {
      if (!Array.isArray(fileds)) throw new Error('setFields 参数需要 Array 类型');
      const formItemsMap = formItemsRef.current.reduce((acc, { current: currItem }) => {
        if (currItem?.name) {
          const { name } = currItem;
          return { ...acc, [name]: currItem };
        }
        return acc;
      }, {});
      fileds.forEach((filed) => {
        const { name, value, status } = filed;
        formItemsMap[name]?.setField({ value, status });
      });
    }

    useImperativeHandle(ref as FormRefInterface, () => ({
      currentElement: formRef.current,
      submit: submitHandler,
      reset: resetHandler,
      getFieldValue,
      setFieldsValue,
      setFields,
      validate,
      getAllFieldsValue,
    }));

    function onFormItemValueChange(changedValue: Record<string, unknown>) {
      const allFileds = getAllFieldsValue();
      onValuesChange(changedValue, allFileds);
    }

    return (
      <FormContext.Provider
        value={{
          labelWidth,
          statusIcon,
          labelAlign,
          layout,
          size,
          colon,
          requiredMark,
          showErrorMessage,
          scrollToFirstError,
          resetType,
          rules,
          formItemsRef,
          onFormItemValueChange,
        }}
      >
        <form className={formClass} style={style} onSubmit={submitHandler} onReset={resetHandler} ref={formRef}>
          {children}
        </form>
      </FormContext.Provider>
    );
  },
  { FormItem },
);

Form.displayName = 'Form';

export default Form;
