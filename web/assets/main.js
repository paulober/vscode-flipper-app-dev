"use strict";

const vscode = acquireVsCodeApi();
var editable = false;

/**
 * @typedef {Object} FamDocumentProperties
 * @property {string} appid
 * @property {string} name
 * @property {string} apptype
 * @property {string} entry_point
 * @property {string} [cdefines]
 * @property {number} [stack_size]
 * @property {number} [order]
 * @property {string[]} [requires]
 * @property {string} [conflicts]
 * @property {string} [icon]
 * @property {string} [sdk_headers]
 * @property {string} [targets]
 * @property {string} [resources]
 * @property {string} [sources]
 * @property {string} [fap_version]
 * @property {string} [fap_icon]
 * @property {string} [fap_libs]
 * @property {string} fap_category
 * @property {string} [fap_description]
 * @property {string} fap_author
 * @property {string} [fap_weburl]
 * @property {string} [fap_icon_assets]
 * @property {string} [fap_extbuild]
 * @property {boolean} [fal_embedded]
 */
/** @type {FamDocumentProperties} */
var props = vscode.getState() ?? properties;

function removeRequireItem(item) {
  if (!props.requires) {
    // add it
    props.requires = [];
  }

  const index = props.requires.indexOf(item);
  if (index > -1) {
    requiredItems.splice(index, 1);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const editRequiresBtn = document.getElementById('editRequires');
  const modal = document.getElementById('requiresModal');
  const modalContent = document.getElementById('requiresModalContent');
  const addRequireModalBtn = document.getElementById('addRequireModal');
  const newRequireInput = document.getElementById('newRequire');
  const closeBtn = document.querySelector('.close');
  const submitBtn = document.getElementById('submitBtn');
  const requiredAppIDs = document.getElementById('required-app-ids');
  const propertiesForm = document.getElementById("appPropertiesForm");

  function updateRequiredItems() {
    // clear requiredAppIDs
    requiredAppIDs.innerHTML = '';
    (props.requires ?? []).forEach(function (item) {
      const liElement = document.createElement('li');
      liElement.textContent = item;
      requiredAppIDs.appendChild(liElement);
    });
  }

  function updateForm() {
    // load props into form -  TODO: maybe load in html directly
    // for each property in props, if the element is set put it in the form
    for (const key in props) {
      if (props.hasOwnProperty(key)) {
        const element = props[key];
        if (element) {
          const input = document.getElementById(key);
          switch (key) {
            case 'requires':
              updateRequiredItems();
              break;
            default:
              input.value = element;
              break;
          }
        }
      }
    }
  }

  updateForm();

  // foreach input element on change update props and safe props into current vscode state
  const inputs = propertiesForm.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('input', function () {
      props[input.id] = input.value;
      vscode.setState(props);
    });
  });

  const selects = propertiesForm.querySelectorAll('select');
  selects.forEach(select => {
    select.addEventListener('change', function () {
      props[select.id] = select.value;
      vscode.setState(props);

      vscode.postMessage({
        type: 'edit',
        property: select.id,
        value: select.value
      })
    });
  });

  editRequiresBtn.addEventListener('click', function () {
    modal.style.display = 'block';
    // Populate modal with existing required items
    modalContent.innerHTML = ''; // Clear previous content
    requiredItems.forEach(function (item) {
      const gridItem = document.createElement('div');
      gridItem.classList.add('grid-item');
      gridItem.textContent = item;

      const removeButton = document.createElement('button');
      removeButton.textContent = 'X';
      removeButton.classList.add('remove-button');
      removeButton.classList.add('float-right');

      // Add click event listener to remove the item
      removeButton.addEventListener('click', function () {
        removeRequireItem(item);
        gridItem.remove();
      });

      gridItem.appendChild(removeButton);
      modalContent.appendChild(gridItem);
    });
  });

  closeBtn.addEventListener('click', function () {
    modal.style.display = 'none';
    updateRequiredItems();
  });

  window.addEventListener('click', function (event) {
    if (event.target == modal) {
      modal.style.display = 'none';
      updateRequiredItems();
    }
  });

  addRequireModalBtn.addEventListener('click', function () {
    const newRequire = newRequireInput.value.trim();
    if (newRequire !== '') {
      const gridItem = document.createElement('div');
      gridItem.classList.add('grid-item');
      gridItem.textContent = newRequire;

      const removeButton = document.createElement('button');
      removeButton.textContent = 'X';
      removeButton.classList.add('remove-button');
      removeButton.classList.add('float-right');

      // Add click event listener to remove the item
      removeButton.addEventListener('click', function () {
        removeRequireItem(newRequire);
        gridItem.remove();
      });

      gridItem.appendChild(removeButton);
      modalContent.appendChild(gridItem);
      newRequireInput.value = '';

      if (!props.requires) {
        // add it
        props.requires = [];
      }
      props.requires.push(newRequire);
    }
  });

  submitBtn.addEventListener('click', function () {
    // get values and names of all input elements in the form and send it to vscode api
    const form = document.getElementById('form');
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    vscode.postMessage({
      command: 'submit',
      data: data
    });
  });

  window.addEventListener('message', event => {
    const { type, body, requestId } = event.data;
    switch (type) {
      case 'init':
        editable = body.editable;

        if (!body.value) {
          return;
        }
        props = body.value;
        updateForm();
        vscode.setState(props);
        break;

      case 'getFileData':
        vscode.postMessage({
          type: 'response',
          requestId,
          body: props
        });
        break;

      default:
        break;
    }
  });
});
