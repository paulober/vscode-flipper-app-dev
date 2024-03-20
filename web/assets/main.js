"use strict";

document.addEventListener('DOMContentLoaded', function () {
  const editRequiresBtn = document.getElementById('editRequires');
  const modal = document.getElementById('requiresModal');
  const modalContent = document.getElementById('requiresModalContent');
  const addRequireModalBtn = document.getElementById('addRequireModal');
  const newRequireInput = document.getElementById('newRequire');
  const closeBtn = document.querySelector('.close');
  const submitBtn = document.getElementById('submitBtn');

  editRequiresBtn.addEventListener('click', function () {
    modal.style.display = 'block';
    // Populate modal with existing required items
    modalContent.innerHTML = ''; // Clear previous content
    // Simulated array of required items
    const requiredItems = ['Item 1', 'Item 2'];
    requiredItems.forEach(function (item) {
      const gridItem = document.createElement('div');
      gridItem.classList.add('grid-item');
      gridItem.textContent = item;
      modalContent.appendChild(gridItem);
    });
  });

  closeBtn.addEventListener('click', function () {
    modal.style.display = 'none';
  });

  window.addEventListener('click', function (event) {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  });

  addRequireModalBtn.addEventListener('click', function () {
    const newRequire = newRequireInput.value.trim();
    if (newRequire !== '') {
      const gridItem = document.createElement('div');
      gridItem.classList.add('grid-item');
      gridItem.textContent = newRequire;
      modalContent.appendChild(gridItem);
      newRequireInput.value = '';
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
});
